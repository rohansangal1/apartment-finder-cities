/**
 * The tools Gemma can call while writing notes about a listing.
 *
 * Why tools at all: a `Listing` from RentCast carries only address, coordinates,
 * rent, bedrooms and property type — no description, amenities, square footage
 * or building history. A model handed that alone can only pad. And Gemma has no
 * built-in web search (that's a Gemini-only feature). So every interesting claim
 * in the notes has to come from a lookup we actually perform, against providers
 * we already run for the rest of the app.
 *
 * That's also why the UI's progress lines are trustworthy: each one is emitted
 * when one of these executors actually fires, not on a timer.
 *
 * Each executor is a thin wrapper over an existing provider and inherits its
 * caching and budget guard, so a notes run costs at most a handful of API calls
 * and usually zero (neighbouring listings share cache keys).
 */
import type { Listing } from '../../../src/lib/types.js';
import { fetchNearbyPlaces, NEARBY_CATEGORIES, type NearbyCategory } from '../providers/places.js';
import { fetchListings } from '../providers/rentcast.js';
import { geocode, commute } from '../providers/google.js';
import type { CommuteMode } from '../../../src/lib/types.js';

/** The JSON-schema shape the Gemini API expects under `tools.functionDeclarations`. */
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** What a tool run reports back: a JSON result for the model, plus the
 * human-readable progress line and source label for the UI. */
export interface ToolResult {
  /** Fed back to the model as a functionResponse. */
  data: unknown;
  /** Shown in the chat panel, e.g. "Searching for grocery stores nearby". */
  label: string;
  /** Credited in the notes footer, e.g. "Google Places". */
  source: string;
}

/** Everything the executors need that isn't a model-chosen argument. */
export interface ToolContext {
  listing: Listing;
  workAddress?: string;
  commuteMode: CommuteMode;
}

export const TOOL_DECLARATIONS: Record<string, FunctionDeclaration> = {
  lookup_nearby_places: {
    name: 'lookup_nearby_places',
    description:
      'Find real businesses or amenities of one category within walking distance of this ' +
      'apartment. Returns up to 5 places with names, Google ratings and distance in metres. ' +
      'Call this to say anything about the neighborhood — never guess what is nearby.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: [...NEARBY_CATEGORIES],
          description: 'Which kind of place to look for.',
        },
      },
      required: ['category'],
    },
  },
  compare_rent_to_market: {
    name: 'compare_rent_to_market',
    description:
      "Compare this apartment's rent against currently-listed rentals with the same bedroom " +
      'count in the same city. Returns the median rent, the sample size, and how far above or ' +
      'below the median this listing sits. Call this before saying anything about price.',
    parameters: { type: 'object', properties: {} },
  },
  estimate_commute: {
    name: 'estimate_commute',
    description:
      "Get the real door-to-door travel time from this apartment to the user's work address, " +
      'using live routing. Call this once if the user has given a work address.',
    parameters: { type: 'object', properties: {} },
  },
};

/**
 * Which tools to offer for this request. `estimate_commute` is withheld entirely
 * when there's no work address — an unusable tool in the list is an invitation
 * for the model to call it and then apologise.
 */
export function declarationsFor(ctx: ToolContext): FunctionDeclaration[] {
  const names = ['lookup_nearby_places', 'compare_rent_to_market'];
  if (ctx.workAddress) names.push('estimate_commute');
  return names.map((n) => TOOL_DECLARATIONS[n]);
}

/** Median of a non-empty numeric list. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Run one model-requested tool call.
 *
 * A tool that fails must not fail the whole run — the model is told what went
 * wrong and writes the notes without that input, which is far better than
 * losing five seconds of work to one flaky upstream.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const { listing } = ctx;

  if (name === 'lookup_nearby_places') {
    const category = String(args.category ?? '') as NearbyCategory;
    const label = `Searching for ${category} near ${listing.neighborhood || listing.city}`;
    if (!NEARBY_CATEGORIES.includes(category)) {
      return { data: { error: `Unknown category "${category}".` }, label, source: 'Google Places' };
    }
    const places = await fetchNearbyPlaces(listing.lat, listing.lng, category);
    return {
      data: places.length ? { category, places } : { category, places: [], note: 'Nothing found within about a kilometre.' },
      label,
      source: 'Google Places',
    };
  }

  if (name === 'compare_rent_to_market') {
    const label = `Comparing rent against similar ${listing.city} listings`;
    const comps = await fetchListings({ city: listing.city, bedrooms: listing.bedrooms });
    const rents = comps.map((c) => c.rentMonthly).filter((r) => r > 0);
    if (rents.length < 3) {
      return {
        data: { note: 'Not enough comparable listings to compute a reliable median.', sampleSize: rents.length },
        label,
        source: 'RentCast comparables',
      };
    }
    const med = median(rents);
    return {
      data: {
        thisRent: listing.rentMonthly,
        medianRent: Math.round(med),
        sampleSize: rents.length,
        pctVsMedian: Math.round(((listing.rentMonthly - med) / med) * 100),
        bedrooms: listing.bedrooms,
        city: listing.city,
      },
      label,
      source: 'RentCast comparables',
    };
  }

  if (name === 'estimate_commute') {
    const label = `Checking the commute to ${ctx.workAddress}`;
    if (!ctx.workAddress) {
      return { data: { error: 'No work address was provided.' }, label, source: 'Google Routes' };
    }
    const destination = await geocode(ctx.workAddress);
    const result = await commute(
      { lat: listing.lat, lng: listing.lng },
      destination,
      ctx.commuteMode
    );
    return {
      data: { minutes: result.minutes, mode: result.mode, destination: ctx.workAddress },
      label,
      source: 'Google Routes',
    };
  }

  return { data: { error: `Unknown tool "${name}".` }, label: 'Checking something', source: '' };
}
