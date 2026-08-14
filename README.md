# Nester — apartment recommendation app

**Live site:** https://apartment-finder-cities.vercel.app/

Nester helps people find apartments in big cities without the overwhelm. You
enter your situation — city, where you work, budget, and what you care about —
and get a **ranked list** of tailored recommendations, each with a **match
score**, **ratings**, and a plain-English reason it matched.

Nester is a discovery/aggregator layer: it does **not** host listings or handle
transactions. Every recommendation links out to its original source.

## What it does

- **Situation-based search** — tell it your city, commute, budget, and
  priorities instead of scrolling endless filters.
- **Match scores** — each listing gets a 0–100 score blending price, commute,
  rating, and space, weighted by what *you* said matters most.
- **Accounts (optional)** — sign in with Google or email/password to save
  listings, store default preferences, and write first-party reviews.
- **Guest mode** — everything works without an account; your saved listings and
  preferences are kept in the browser.

## How it works

The app has three layers, each swappable via configuration:

1. **The SPA** (`src/`) — a React + TypeScript single-page app with a dark,
   editorial landing page (hero, apartment carousel, address autocomplete).
2. **The API** (`api/`) — Vercel serverless functions that talk to real
   providers (listings, geocoding, commute, ratings) with caching, per-IP rate
   limiting, and a daily-budget circuit breaker.
3. **Storage** (`supabase/`) — Supabase (Postgres + Auth + Row-Level Security)
   for accounts, saved listings, and reviews.

**The one rule:** the UI never calls an external data source directly. It only
imports from `src/lib/data-client`, which picks its implementation from an
environment variable. Running against mock fixtures vs. live provider APIs is a
**config change**, not a rewrite — the `DataClient` interface in `types.ts` is
the contract, and the compiler enforces that every implementation matches.

## Getting started (contributors)

### Prerequisites

- Node.js 18+ and npm
- A Supabase project and provider API keys are **only** needed if you want to
  run against live data or accounts. By default the app runs entirely on
  in-browser mock fixtures — no keys, no backend.

### Run it locally

```bash
git clone https://github.com/rohansangal1/apartment-finder-cities.git
cd apartment-finder
npm install
npm run dev        # http://localhost:5173
```

That's it — the app boots with mock data and guest-mode storage.

### Useful scripts

```bash
npm run dev        # Vite dev server at http://localhost:5173
npm run typecheck  # tsc project-references check (app + api), no emit
npm test           # Vitest, single run
npm run test:watch # Vitest in watch mode
npm run build      # tsc -b && vite build → dist/
npm run preview    # preview the production build locally
```

### Tests

Vitest with jsdom and Testing Library. Test files sit next to what they cover
(`src/lib/scoring.test.ts`), so they're typechecked by the same `tsc -b` as the
app and never reach the bundle. Two layers:

- **Unit** — the pure modules (`scoring`, `true-cost`, `affordability`,
  `format`, `listing-links`, `deal-score`), plus component behaviour for the
  search wizard, results view, score breakdown and the How It Works page.
- **Integration** — `search-service.integration.test.ts` runs the whole
  orchestration through the *real* mock data client with no module stubs, so a
  renamed client method or a fixture that stops matching a city fails loudly.

`how-it-works-view.test.tsx` recomputes the page's worked example from
`lib/scoring.ts` and asserts the rendered numbers agree, so the explainer can't
drift away from the engine it documents.

### Environment variables

Copy `.env.example` to `.env.local` and fill in only what you need. Everything
is optional — leave a section blank and that feature falls back gracefully
(mock data / guest mode / in-memory cache).

| Variable | Purpose |
|----------|---------|
| `VITE_DATA_SOURCE` | `mock` (default, in-browser fixtures) or `api` (call `/api`) |
| `RENTCAST_API_KEY` | Listings provider (server-side only) |
| `GOOGLE_MAPS_API_KEY` | Geocoding, Routes (commute), Places (ratings) — one key, three APIs enabled |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Shared cache + rate limiter for production |
| `DAILY_BUDGET_USD`, `RATE_LIMIT_*` | Circuit breaker + rate-limit tuning |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Enable accounts, saved listings, reviews |

> Anything prefixed `VITE_` is bundled into the browser and must be safe to
> expose. Provider secrets (RentCast, Google) are **server-side only** — never
> prefix them with `VITE_`.

To run the serverless functions locally, use `vercel dev` instead of
`npm run dev` (the functions in `api/` run on Vercel's runtime).

### Enabling live data

1. Add `RENTCAST_API_KEY` and `GOOGLE_MAPS_API_KEY` (in Vercel project settings,
   or `.env` for local `vercel dev`).
2. Set `VITE_DATA_SOURCE=api`.
3. Deploy, or run `vercel dev`.

No view or component changes are needed — `api-client.ts` satisfies the same
`DataClient` interface as the mock client, and the server reuses the same
`scoring.ts`. See [`api/README.md`](api/README.md) for endpoint details.

### Enabling accounts (Supabase)

Follow [`supabase/README.md`](supabase/README.md): apply the SQL migrations,
configure Google OAuth, and set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
With no Supabase env vars, the app stays in guest mode (localStorage).

## Project structure

```
src/
  lib/
    data-client/        ← the ONLY boundary to external data
      index.ts          ← picks impl by VITE_DATA_SOURCE (mock | api)
      mock-client.ts    ← in-browser fixtures
      api-client.ts     ← calls /api, same DataClient interface
    mock-data/          ← listings, reviews, geo fixtures
    user-data/          ← per-user persistence (local-store | supabase-store)
    scoring.ts          ← pure match-scoring engine (scoreListing, weights, why)
    search-service.ts   ← search orchestration
    supabase.ts         ← Supabase client (guest mode when env vars absent)
    types.ts            ← shared data model (interfaces + DataClient contract)
    format.ts           ← display + graceful link-rot fallback helpers
  context/
    search-context.tsx     ← criteria, results, saved IDs
    auth-context.tsx       ← Supabase Google + email/password sign-in
    user-data-context.tsx  ← picks local vs Supabase UserStore
  components/           ← layout, listing-card, match-score, rating, tag,
                          address-autocomplete, apartment-carousel,
                          save-button, review-form
  views/                ← input-view, results-view, detail-view,
                          saved-view, account-view
api/                    ← serverless functions (search, geocode, commute, rating)
supabase/               ← SQL migrations + setup guide
```

## Match scoring

`scoreListing(listing, criteria, commuteMinutes)` in `src/lib/scoring.ts`
computes four 0–100 sub-scores (price, commute, rating, space), combines them by
the user's normalized priority weights, and clamps to 0–100. `explainMatch()`
turns the top sub-scores into the "why it matched" line. Unknown ratings sit at
a neutral 60, never zero; missing data is never fabricated.

Price fit measures the *headroom* a listing leaves against your cap rather than
passing/failing at it, and the curve is continuous across the cap — going over
budget can never improve a listing's price fit. `scoring.test.ts` pins that
property, along with monotonicity and the 0–100 bounds.

## Design notes

- **Cold start:** the schema supports first-party reviews from day one; the
  rating blend shifts weight toward verified residents as their count grows.
- **Link rot:** `resolveListingUrl()` degrades a stale or missing deep link to a
  source-site search URL — never a dead link.
- **Saved listings survive churn:** each save stores a full listing snapshot
  (JSON), so the Saved page renders from stored data even after external
  listings disappear.
- **Explicit constraints:** listing-metadata access and rating coverage are the
  real limits; they sit behind clean interfaces so real sources drop in without
  touching the UI.

## Deployment

Deployed on Vercel. `vercel.json` includes the SPA rewrite. The static SPA needs
no secrets; live data and accounts turn on by adding the env vars above in the
Vercel project settings.

### Security headers

`vercel.json` sets HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, a
`Permissions-Policy` denying hardware we never use, and a CSP. JSON takes no
comments, so the CSP allowlist is explained here — every entry exists for one
concrete dependency, and removing the dependency should mean removing the entry:

| Directive | Why |
| --- | --- |
| `script-src accounts.google.com gstatic.com` | Google Identity Services (`google-signin-button.tsx`) loads `gsi/client` in-page. |
| `style-src 'unsafe-inline'` | Leaflet and React both set inline styles. Not removable without dropping the map. |
| `style-src`/`font-src fonts.googleapis.com`/`fonts.gstatic.com` | The Inter webfont, linked from `index.html`. |
| `img-src https:` | Listing photos come from whatever CDN the upstream provider uses — the hosts aren't known ahead of time. |
| `connect-src *.supabase.co` | Auth + data. Wildcarded because the project URL is an env var, not a build constant. |
| `frame-src accounts.google.com` | GIS renders its button and FedCM prompt in an iframe. |

`frame-ancestors 'none'` is the pair to `X-Frame-Options: DENY` — nothing embeds
this app.

HSTS deliberately omits `preload`. Preloading is a domain-wide, effectively
irreversible commitment baked into browsers, so it should be a deliberate
decision once a custom domain is settled, not a default.

**Changing the CSP requires a preview deploy to verify.** `vite preview` does not
apply `vercel.json` headers, so a broken policy will not show up locally. Smoke
test on a preview URL: the map tiles, Google sign-in, the webfont, and listing
photos. If something breaks, switching the key to
`Content-Security-Policy-Report-Only` downgrades it to console warnings while you
find the missing origin.
