# `/api` — serverless functions (Phase 1)

Why a backend exists here (and not in Phase 0): **secret keys** can't live in
browser code, and these APIs **bill per call** so responses must be cached. Both
forces are handled in this folder. The browser only ever talks to these
endpoints (via `src/lib/dataClient/apiClient.ts`) — never to RentCast/Google
directly.

Folders/files starting with `_` are **not** routed as functions — `_lib/` is
shared server code.

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search` | POST | Orchestrate listings → geocode → commute → ratings → score → ranked results, in one round-trip. Body = `SearchCriteria`. |
| `/api/geocode` | GET | `?address=` → `{ lat, lng }` (cached ~forever). |
| `/api/commute` | GET | `?originLat&originLng&destLat&destLng&mode` → `{ minutes, mode }`. Progressive hydration. |
| `/api/rating` | GET | `?address&city` → `{ value, source }`. `value: null` when sparse. |
| `/api/ai-notes` | POST | **Server-Sent Events**, not JSON. Body = `{ listing, workAddress?, commuteMode? }`. Streams `step` / `token` / `done` / `error` events while Gemma 4 researches and writes notes about one listing. |

## `_lib/` building blocks

- **`env.ts`** — `requireEnv` (503 on missing key), budget/rate-limit config, `HttpError`.
- **`cache.ts`** — read-through cache. Upstash Redis when `UPSTASH_*` is set, else in-process Map. TTLs: geocode ~1yr, commute 2wk, rating 1wk, listings 6h.
- **`rateLimit.ts`** — per-IP fixed-window limiter (Upstash or memory). 429 when exceeded.
- **`budgetGuard.ts`** — daily spend estimate + circuit breaker; trips at `DAILY_BUDGET_USD`.
- **`handler.ts`** — wraps every endpoint: CORS, method check, rate limit, error → JSON. `withStreamHandler` is the SSE sibling for `/api/ai-notes` (same gate, streams events instead of one body; runs on the normal Node runtime — streaming does not need the edge runtime).
- **`providers/`** — `rentcast` (listings), `google` (geocode + commute via Routes), `places` (ratings + `fetchNearbyPlaces` for AI notes).
- **`ai/`** — `gemma.ts` (Gemma 4 over the Gemini API, one tool-calling turn per call, capped at 4 turns) and `tools.ts` (the three lookups the model can run, each wrapping an existing provider). Gemma is free-tier only, so its quota is shared by all users: `/api/ai-notes` caps each IP at 25 runs a day and maps upstream 429s to a plain-English message.
- **`ratings.ts`** — blends external + first-party reviews (first-party empty until Phase 2).
- **`orchestrate.ts`** — the `/api/search` flow; reuses the SAME `src/lib/scoring.ts` as the client.

## Going live

1. Set `RENTCAST_API_KEY` and `GOOGLE_MAPS_API_KEY` in Vercel project settings
   (see `.env.example`). The Google key needs Geocoding API, Routes API, and
   Places API (New) enabled.
2. (Recommended) Set `UPSTASH_REDIS_REST_URL` + `_TOKEN` so cache + rate limits
   are durable across invocations. This matters more for AI notes than anything
   else: without it the per-IP daily cap resets whenever a function instance is
   recycled.
3. For AI notes, set `GEMINI_API_KEY` (from aistudio.google.com) and apply the
   `0011_ai_notes.sql` migration. Without the key the endpoint returns 503.
4. Set the client's `VITE_DATA_SOURCE=api` and redeploy.

## Local development

```bash
npm i -g vercel        # once
vercel dev             # serves the SPA + /api functions together
```
Put the secrets in a local `.env` (gitignored) for `vercel dev`. Without keys,
endpoints return a clear 503 — the UI still runs on `VITE_DATA_SOURCE=mock`.

## Known Phase 1 limitation

Deep-linking straight to a detail page (or the Saved view) calls
`getListings({ city: '' })` to rehydrate, which has no city to search. Phase 2's
`listings_cache` table fixes this (rank/rehydrate without re-hitting the API).
Until then, those views are reliable when reached via a search in-session.
