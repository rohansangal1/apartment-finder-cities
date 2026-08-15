/**
 * POST /api/ai-notes — stream AI-written notes about one listing.
 *
 * The response is Server-Sent Events rather than a single JSON body because a
 * run takes several seconds of real work and the UI narrates it:
 *
 *   step   {"label":"Comparing rent against similar Brooklyn listings"}
 *   token  {"text":"…"}
 *   reset  {}                     (discard streamed prose — it was a preamble)
 *   done   {"text":"…","sources":[…],"model":"gemma-4-31b-it","generatedAt":"…"}
 *   error  {"message":"…"}
 *
 * Every `step` is emitted at the moment a lookup actually fires (see
 * `_lib/ai/tools.ts`) — the panel never shows progress for work that didn't
 * happen.
 *
 * Unlike the rest of the app, this endpoint requires a signed-in user. Every run
 * spends from a shared free-tier model quota, so an anonymous caller is a cost
 * we can't attribute, cap, or revoke. Requiring a verified identity is what makes
 * the per-user limits below meaningful — an IP is not an identity.
 *
 * Gates run cheapest-first, so a flood is refused before it spends anything:
 *
 *   1. per-IP per-minute   (withStreamHandler, blanket — no I/O)
 *   2. same-origin         (assertSameOrigin — CSRF, header check only)
 *   3. auth                (requireUserId → 401)
 *   4. per-user per-minute (burst control)
 *   5. per-user per-day    (budget control)
 *   6. per-IP per-day      (backstop against many throwaway accounts)
 *   7. global throughput   (awaitModelSlot — project-wide token ceiling)
 *
 * Those bound how OFTEN a run can start. What bounds how much one run can COST
 * is separate and just as necessary: the listing arrives in the request body, so
 * every field of it is clamped before it reaches the prompt (see `clean`), the
 * model call has a hard timeout, and MAX_TURNS caps the round-trips.
 */
import type { VercelRequest } from '@vercel/node';
import { withStreamHandler, type Emit } from './_lib/handler.js';
import { HttpError, AI_RATE_LIMIT_MAX, AI_RATE_LIMIT_WINDOW_SEC } from './_lib/env.js';
import { enforceDailyQuota, enforceUserQuota } from './_lib/rateLimit.js';
import { requireUserId } from './_lib/supabase-admin.js';
import { assertSameOrigin } from './_lib/session.js';
import { generateTurn, MAX_TURNS, MODEL, type Content } from './_lib/ai/gemma.js';
import { declarationsFor, runTool, type ToolContext } from './_lib/ai/tools.js';
import { awaitModelSlot } from './_lib/ai/throughput.js';
import type { Listing, CommuteMode } from '../src/lib/types.js';

/** Notes runs per user per day. Generous for a real shopper, useless for a scraper. */
const DAILY_MAX = 25;

/**
 * Per-IP daily backstop, sitting above the per-user cap so it only bites when a
 * single origin is driving many accounts. Deliberately not a multiple of
 * DAILY_MAX: a household or an office sharing one NAT is normal traffic.
 */
const IP_DAILY_MAX = 60;

const COMMUTE_MODES: CommuteMode[] = ['walk', 'transit', 'bike', 'drive'];

const SYSTEM_PROMPT = `You are helping someone decide whether an apartment is worth their time.

You know only what is in the listing below plus whatever your tools return. The listing data comes from a rental feed that carries no description, no amenity list, no square footage and no building history — so you genuinely do not know those things.

Rules:
- Call your tools before making any claim about the neighborhood, the price, or the commute. Prefer two or three lookups over one.
- Never invent amenities, square footage, year built, renovation status, landlord quality, or noise levels. If you don't know, say what the reader should go check.
- Refer to real places by name when a lookup returns them ("Trader Joe's, 300 m away").
- If a lookup comes back empty, say so plainly — "no grocery store turned up within a kilometre" is useful information.

Write about 150 words, in this shape:
A two-sentence take on the place.
**Good signs** — 2 to 4 short bullets, each grounded in a lookup or the listing data.
**Worth checking** — 2 to 3 short bullets on what the data can't tell them.

Plain, direct language. No sales copy, no "nestled in the heart of".`;

/**
 * Every field below arrives in the request body, so it is caller-controlled text
 * heading straight into a prompt. Clamping it matters for two reasons:
 *
 *   Cost. Gemma's free tier is capped per *minute*, project-wide. One request
 *   carrying a megabyte-long "address" would spend that whole minute for
 *   everyone, and none of the counters above would notice — a request is one
 *   request however large it is. The quota gates limit how *often* you can call;
 *   this is what limits how *much* a single call can cost.
 *
 *   Injection. Newlines and control characters let a crafted field break out of
 *   its `Address: …` line and read as instructions. It can only ever steer the
 *   caller's own notes — there is nothing in the context belonging to anyone
 *   else, and no secret in the system prompt — so this is untidiness rather than
 *   a breach. The same truncation closes it either way.
 */
function clean(value: unknown, max = 200): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

/** A number we're willing to print, or null. Rejects NaN, Infinity and junk. */
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Compact the listing into the prompt. Only fields we actually have. */
function describeListing(l: Listing): string {
  const rent = num(l.rentMonthly);
  const beds = num(l.bedrooms);
  const rating = num(l.ratingValue);
  // Tags are a caller-supplied array, so cap the count as well as each entry —
  // a thousand short tags cost the same as one long one.
  const tags = (Array.isArray(l.tags) ? l.tags : [])
    .slice(0, 8)
    .map((t) => clean(t, 40))
    .filter(Boolean);

  const lines = [
    `Address: ${clean(l.address)}`,
    l.neighborhood ? `Neighborhood: ${clean(l.neighborhood)}` : null,
    `City: ${clean(l.city, 100)}`,
    rent != null ? `Rent: $${Math.round(rent)}/month` : null,
    beds != null ? `Bedrooms: ${beds}` : null,
    tags.length ? `Property type / tags: ${tags.join(', ')}` : null,
    rating != null ? `Building rating: ${rating} (${clean(l.ratingSource, 60)})` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

/** Exported for tests — the input clamps are the part worth pinning down. */
export const __test = { clean, describeListing };

interface RequestBody {
  listing?: Listing;
  workAddress?: string;
  commuteMode?: CommuteMode;
}

export default withStreamHandler('POST', async (req: VercelRequest, emit: Emit, res) => {
  // Cookie-authenticated and it spends a shared quota, so another site making
  // the browser fire this off is a real cost even though it could never read the
  // stream back. Same gate as /api/data, for the same reason.
  assertSameOrigin(req);

  // Auth before anything else. It's the only gate that establishes *who* is
  // spending, so every limit below is keyed off its result — and it runs before
  // the body is even parsed, so an unauthenticated flood costs us one token
  // verification and nothing more.
  const userId = await requireUserId(req, res);

  // Burst, then budget. Both are keyed on the verified user id.
  await enforceUserQuota(
    'ai-notes',
    userId,
    AI_RATE_LIMIT_MAX,
    AI_RATE_LIMIT_WINDOW_SEC,
    `That's ${AI_RATE_LIMIT_MAX} sets of notes in under a minute — give it a moment and try again.`
  );
  await enforceUserQuota(
    'ai-notes-daily',
    userId,
    DAILY_MAX,
    86_400,
    `You've generated ${DAILY_MAX} sets of notes today — that's the daily limit. Try again tomorrow.`
  );

  // Backstop: one origin driving many accounts. Only bites well above what a
  // shared household or office connection would produce.
  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : '') || 'unknown';
  await enforceDailyQuota(
    'ai-notes',
    ip,
    IP_DAILY_MAX,
    'AI notes have hit their daily limit for this network. Try again tomorrow.'
  );

  const body = (req.body ?? {}) as RequestBody;
  const listing = body.listing;
  if (!listing?.id || typeof listing.lat !== 'number' || typeof listing.lng !== 'number') {
    throw new HttpError(400, 'A listing with coordinates is required.');
  }

  // The work address reaches both the prompt and Google's geocoder, so it gets
  // the same clamp as the listing fields. 200 characters is longer than any real
  // postal address.
  const workAddress = clean(body.workAddress);

  const ctx: ToolContext = {
    listing,
    workAddress: workAddress || undefined,
    // Allowlisted rather than passed through: it reaches Google Routes as a
    // travel mode, and an unrecognised value there is an error, not a default.
    commuteMode: COMMUTE_MODES.includes(body.commuteMode as CommuteMode)
      ? (body.commuteMode as CommuteMode)
      : 'transit',
  };
  const tools = declarationsFor(ctx);

  emit('step', { label: 'Reading the listing' });

  // Hold here if the project is already at its per-minute model throughput.
  // Waiting a few seconds is a better outcome than a 429 the user has to act
  // on, so a burst of clicks queues rather than half-failing. The step label
  // only appears when we actually have to wait, so a quiet moment shows nothing.
  await awaitModelSlot(() => emit('step', { label: 'Waiting for a free slot' }));

  const contents: Content[] = [
    {
      role: 'user',
      parts: [
        {
          text: `Write notes for this apartment.\n\n${describeListing(listing)}${
            ctx.workAddress ? `\n\nThe reader commutes to: ${ctx.workAddress}` : ''
          }`,
        },
      ],
    },
  ];

  // Sources are collected from the tools that actually ran, so the footer credits
  // real lookups rather than a hardcoded list.
  const sources = new Set<string>();
  let text = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const isFinal = turn === MAX_TURNS - 1;
    if (isFinal) emit('step', { label: 'Writing your notes' });

    const result = await generateTurn({
      system: SYSTEM_PROMPT,
      contents,
      // Withhold tools on the last turn so the model has no choice but to answer.
      tools: isFinal ? [] : tools,
      onToken: (t) => emit('token', { text: t }),
    });

    if (!result.calls.length) {
      text = result.text;
      break;
    }

    // The model asked for tools, so whatever prose it streamed this turn was a
    // preamble to that ("Let me check the rent…"), not the notes. Tell the panel
    // to drop it, or the user reads text that won't be in what they save.
    if (result.text) emit('reset', {});

    // Run the tools, tell the UI what's happening, and feed the results back.
    contents.push({
      role: 'model',
      parts: result.calls.map((c) => ({ functionCall: { name: c.name, args: c.args } })),
    });

    const responses = [];
    for (const call of result.calls) {
      let outcome;
      try {
        outcome = await runTool(call.name, call.args, ctx);
        emit('step', { label: outcome.label });
      } catch (err) {
        // One flaky upstream must not lose the whole run — hand the model the
        // failure and let it write around the gap.
        const message = err instanceof Error ? err.message : 'lookup failed';
        console.error(`ai-notes tool ${call.name} failed`, err);
        outcome = { data: { error: message }, label: '', source: '' };
      }
      if (outcome.source) sources.add(outcome.source);
      responses.push({
        functionResponse: { name: call.name, response: { result: outcome.data } },
      });
    }
    contents.push({ role: 'user', parts: responses });
  }

  if (!text.trim()) {
    throw new HttpError(502, 'The model returned nothing usable. Please try again.');
  }

  emit('done', {
    text: text.trim(),
    sources: [...sources],
    model: MODEL,
    generatedAt: new Date().toISOString(),
  });
});
