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
 * happen. Guests are allowed, matching the rest of the app, but the shared
 * free-tier model quota means this endpoint carries a per-IP daily cap on top of
 * the usual per-minute limit.
 */
import type { VercelRequest } from '@vercel/node';
import { withStreamHandler, type Emit } from './_lib/handler.js';
import { HttpError } from './_lib/env.js';
import { enforceDailyQuota } from './_lib/rateLimit.js';
import { generateTurn, MAX_TURNS, MODEL, type Content } from './_lib/ai/gemma.js';
import { declarationsFor, runTool, type ToolContext } from './_lib/ai/tools.js';
import type { Listing, CommuteMode } from '../src/lib/types.js';

/** Notes runs per IP per day. Generous for a real shopper, useless for a scraper. */
const DAILY_MAX = 25;

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

/** Compact the listing into the prompt. Only fields we actually have. */
function describeListing(l: Listing): string {
  const lines = [
    `Address: ${l.address}`,
    l.neighborhood ? `Neighborhood: ${l.neighborhood}` : null,
    `City: ${l.city}`,
    `Rent: $${l.rentMonthly}/month`,
    `Bedrooms: ${l.bedrooms}`,
    l.tags.length ? `Property type / tags: ${l.tags.join(', ')}` : null,
    l.ratingValue != null ? `Building rating: ${l.ratingValue} (${l.ratingSource})` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

interface RequestBody {
  listing?: Listing;
  workAddress?: string;
  commuteMode?: CommuteMode;
}

export default withStreamHandler('POST', async (req: VercelRequest, emit: Emit) => {
  const body = (req.body ?? {}) as RequestBody;
  const listing = body.listing;
  if (!listing?.id || typeof listing.lat !== 'number' || typeof listing.lng !== 'number') {
    throw new HttpError(400, 'A listing with coordinates is required.');
  }

  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : '') || 'unknown';
  await enforceDailyQuota(
    'ai-notes',
    ip,
    DAILY_MAX,
    `You've generated ${DAILY_MAX} sets of notes today — that's the daily limit. Try again tomorrow.`
  );

  const ctx: ToolContext = {
    listing,
    workAddress: body.workAddress?.trim() || undefined,
    commuteMode: body.commuteMode ?? 'transit',
  };
  const tools = declarationsFor(ctx);

  emit('step', { label: 'Reading the listing' });

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
