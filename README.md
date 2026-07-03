# Nester — apartment recommendation app
Deployed website link: https://apartment-finder-cities.vercel.app/
Helps people find apartments in big cities without the overwhelm. Enter your
situation (city, work, budget, priorities) and get a **ranked list** of tailored
recommendations with **match scores** and **ratings**. Nester is a
discovery/aggregator layer — it does **not** host listings or handle
transactions; every recommendation links out to its source.

The app is a React + TypeScript SPA fronted by a dark, editorial landing page
(hero + apartment carousel + address autocomplete). All three phases are built
and layered additively:

- **Phase 0** — SPA with mock data, deployable as a static site.
- **Phase 1** — real provider APIs behind serverless functions (`api/`).
- **Phase 2** — Supabase accounts, saved listings, and first-party reviews.

Each later phase turns on with config/keys, not a rewrite — see the phase
sections below.

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
    data-client/        ← the ONLY boundary to external data
      index.ts          ← picks impl by VITE_DATA_SOURCE (mock | api)
      mock-client.ts    ← Phase 0 in-browser fixtures
      api-client.ts     ← Phase 1: calls /api, same DataClient interface
    mock-data/          ← listings, reviews, geo fixtures
    user-data/          ← per-user persistence (local-store | supabase-store + types)
    scoring.ts          ← pure match-scoring engine (scoreListing, weights, why)
    search-service.ts   ← orchestration (lifts into POST /api/search later)
    supabase.ts         ← Supabase client (guest mode when env vars absent)
    types.ts            ← shared data model (interfaces + DataClient contract)
    format.ts           ← display + graceful link-rot fallback helpers
  context/
    search-context.tsx     ← criteria, results, saved IDs
    auth-context.tsx       ← Supabase Google sign-in
    user-data-context.tsx  ← picks local vs Supabase UserStore
  components/           ← layout, listing-card, match-score, rating, tag,
                          address-autocomplete, apartment-carousel,
                          save-button, review-form
  views/                ← input-view, results-view, detail-view,
                          saved-view, account-view
api/                    ← Phase 1 serverless functions (search, geocode, commute, rating)
supabase/               ← Phase 2 SQL migrations + setup guide
```

### The one rule

The UI never calls an external source directly — it only imports from
`src/lib/data-client`. Going live is a **config change** (`VITE_DATA_SOURCE=api`),
not a rewrite. The `DataClient` interface in `types.ts` is the contract every
implementation must satisfy — the compiler enforces that `api-client.ts` matches
`mock-client.ts` exactly.

## Data interfaces (mock now → production target)

| Need | Now | Production target |
|------|-----|-------------------|
| `getListings(criteria)` | mock | RentCast (free tier) |
| `getCommute(origin, dest, mode)` | mock (haversine) | TravelTime (transit-aware) → Google Routes |
| `getRating(building)` | mock blend | Google Places/Yelp → first-party reviews |
| `geocode(address)` | mock | TravelTime / Google / Nominatim |

## Match scoring

`scoreListing(listing, criteria, commuteMinutes)` in `src/lib/scoring.ts`
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

No view/component changes — `api-client.ts` satisfies the same `DataClient`
interface as `mock-client.ts`, and the server reuses the same `scoring.ts`.

See [`api/README.md`](api/README.md) for endpoint details.

## Phase 2 — accounts, saved, reviews (built, needs Supabase)

Auth + per-user persistence via Supabase (Postgres + Google Auth + RLS):

- **Google sign-in** — `AuthContext` wraps `supabase.auth.signInWithOAuth`.
- **Saved listings & default preferences** — persisted per user; returning users
  skip re-entering their situation. Each save stores a **full listing snapshot**
  (JSON), so the Saved page renders straight from stored data and survives
  listing churn — external listings are ephemeral and can't be re-fetched by id
  (see migration `0002_saved_snapshot.sql`).
- **First-party reviews** — read + write, gated behind sign-in; `lived_here`
  verified reviews are the trust moat.
- **Row-Level Security** — users touch only their own rows; reviews stay public.

It's all behind a `UserStore` interface with two implementations
([local-store](src/lib/user-data/local-store.ts) for guests,
[supabase-store](src/lib/user-data/supabase-store.ts) for signed-in users), chosen
by [user-data-context](src/context/user-data-context.tsx). With no Supabase env vars,
the app runs in **guest mode** (localStorage) — exactly like Phase 0/1.

To enable: follow [`supabase/README.md`](supabase/README.md) (apply the SQL
schema, configure Google OAuth, set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`).
