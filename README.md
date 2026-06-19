# Nestle — Apartment recommendation app

Helps people find apartments in big cities without the overwhelm. Enter your
situation (city, work, budget, priorities) and get a **ranked list** of tailored
recommendations with **match scores** and **ratings**. Nestle is a
discovery/aggregator layer — it does **not** host listings or handle
transactions; every recommendation links out to its source.

This repo is **Phase 0** (prototype): a pure React + TypeScript SPA with mock
data, ready to deploy as a static site. The architecture is built so Phase 1
(real APIs behind serverless functions) and Phase 2 (Supabase accounts +
reviews) are *additive*.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc project-references check, no emit
npm run build      # tsc -b && vite build into dist/
npm run preview    # preview the production build
```

## Architecture

```
src/
  lib/
    dataClient/         ← the ONLY boundary to external data
      index.ts          ← picks impl by VITE_DATA_SOURCE (mock | api)
      mockClient.ts     ← Phase 0 in-browser fixtures
      (apiClient.ts)    ← Phase 1: calls /api, same DataClient interface
    mockData/           ← listings, reviews, geocode fixtures
    scoring.ts          ← pure match-scoring engine (scoreListing, weights, why)
    searchService.ts    ← orchestration (lifts into POST /api/search later)
    types.ts            ← shared data model (interfaces + DataClient contract)
    format.ts           ← display + graceful link-rot fallback helpers
  context/
    SearchContext.tsx   ← criteria, results, saved IDs
  components/           ← Layout, ListingCard, MatchScore, Rating, ...
  views/                ← InputView, ResultsView, DetailView, SavedView, AccountView
api/                    ← empty in Phase 0; serverless functions land here
```

### The one rule

The UI never calls an external source directly — it only imports from
`src/lib/dataClient`. Going live is a **config change** (`VITE_DATA_SOURCE=api`
+ adding `apiClient.ts`), not a rewrite. The `DataClient` interface in
`types.ts` is the contract every implementation must satisfy — the compiler
enforces that `apiClient.ts` matches `mockClient.ts` exactly.

## Data interfaces (mock now → production target)

| Need | Now | Production target |
|------|-----|-------------------|
| `getListings(criteria)` | mock | RentCast (free tier) |
| `getCommute(origin, dest, mode)` | mock (haversine) | TravelTime (transit-aware) → Google Routes |
| `getRating(building)` | mock blend | Google Places/Yelp → first-party reviews |
| `geocode(address)` | mock | TravelTime / Google / Nominatim |

## Match scoring

`scoreListing(listing, criteria, commuteMinutes)` in `src/lib/scoring.js`
computes four 0–100 sub-scores (price, commute, rating, space), combines them by
the user's normalized priority weights, and clamps to 0–100. `explainMatch()`
turns the top sub-scores into the "why it matched" line. Unknown ratings sit at a
neutral 60, never zero; missing data is never fabricated.

## Built for the realities

- **Cold start:** the schema supports first-party reviews from day one; the
  rating blend shifts weight toward verified residents as their count grows.
- **Link rot:** `resolveListingUrl()` degrades a stale/missing deep link to a
  source-site search URL — never a dead link.
- **Constraints are explicit:** listing-metadata access and rating coverage are
  the real limits; they're stubbed behind clean interfaces so real sources drop
  in without touching the UI.

## Deploy (Phase 0)

Static site on Vercel or Netlify. `vercel.json` includes the SPA rewrite. No
secrets, nothing to persist.

## Phase 1 — real APIs (built, needs keys)

The serverless layer is implemented in [`api/`](api/README.md): `POST /api/search`
(orchestration) plus `/api/geocode`, `/api/commute`, `/api/rating`, with caching,
per-IP rate limiting, and a daily budget circuit breaker. Providers: RentCast
(listings), TravelTime (geocode + commute), Google Places (ratings).

To switch the app from mock → live:

1. Add the provider keys in Vercel project settings (see `.env.example`).
2. Set `VITE_DATA_SOURCE=api`.
3. Deploy (or run `vercel dev` locally).

No view/component changes — `apiClient.ts` satisfies the same `DataClient`
interface as `mockClient.ts`, and the server reuses the same `scoring.ts`.

See [`api/README.md`](api/README.md) for endpoint details.

## Phase 2 — accounts, saved, reviews (built, needs Supabase)

Auth + per-user persistence via Supabase (Postgres + Google Auth + RLS):

- **Google sign-in** — `AuthContext` wraps `supabase.auth.signInWithOAuth`.
- **Saved listings & default preferences** — persisted per user; returning users
  skip re-entering their situation.
- **First-party reviews** — read + write, gated behind sign-in; `lived_here`
  verified reviews are the trust moat.
- **Row-Level Security** — users touch only their own rows; reviews stay public.

It's all behind a `UserStore` interface with two implementations
([localStore](src/lib/userData/localStore.ts) for guests,
[supabaseStore](src/lib/userData/supabaseStore.ts) for signed-in users), chosen
by [UserDataContext](src/context/UserDataContext.tsx). With no Supabase env vars,
the app runs in **guest mode** (localStorage) — exactly like Phase 0/1.

To enable: follow [`supabase/README.md`](supabase/README.md) (apply the SQL
schema, configure Google OAuth, set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`).
