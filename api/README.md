# `/api` — serverless functions (Phase 1)

Why a backend exists here (and not in Phase 0): **secret keys** can't live in
browser code, and these APIs **bill per call** so responses must be cached. Both
forces are handled in this folder. The browser only ever talks to these
endpoints (via `src/lib/dataClient/apiClient.ts`) — never to RentCast/TravelTime/
Google directly.

Folders/files starting with `_` are **not** routed as functions — `_lib/` is
shared server code.

## Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search` | POST | Orchestrate listings → geocode → commute → ratings → score → ranked results, in one round-trip. Body = `SearchCriteria`. |
| `/api/geocode` | GET | `?address=` → `{ lat, lng }` (cached ~forever). |
| `/api/commute` | GET | `?originLat&originLng&destLat&destLng&mode` → `{ minutes, mode }`. Progressive hydration. |
| `/api/rating` | GET | `?address&city` → `{ value, source }`. `value: null` when sparse. |

## `_lib/` building blocks

- **`env.ts`** — `requireEnv` (503 on missing key), budget/rate-limit config, `HttpError`.
- **`cache.ts`** — read-through cache. Upstash Redis when `UPSTASH_*` is set, else in-process Map. TTLs: geocode ~1yr, commute 2wk, rating 1wk, listings 6h.
- **`rateLimit.ts`** — per-IP fixed-window limiter (Upstash or memory). 429 when exceeded.
- **`budgetGuard.ts`** — daily spend estimate + circuit breaker; trips at `DAILY_BUDGET_USD`.
- **`handler.ts`** — wraps every endpoint: CORS, method check, rate limit, error → JSON.
- **`providers/`** — `rentcast` (listings), `traveltime` (geocode + commute), `places` (ratings).
- **`ratings.ts`** — blends external + first-party reviews (first-party empty until Phase 2).
- **`orchestrate.ts`** — the `/api/search` flow; reuses the SAME `src/lib/scoring.ts` as the client.

## Going live

1. Set `RENTCAST_API_KEY`, `TRAVELTIME_APP_ID`, `TRAVELTIME_API_KEY`,
   `GOOGLE_MAPS_API_KEY` in Vercel project settings (see `.env.example`).
2. (Recommended) Set `UPSTASH_REDIS_REST_URL` + `_TOKEN` so cache + rate limits
   are durable across invocations.
3. Set the client's `VITE_DATA_SOURCE=api` and redeploy.

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
