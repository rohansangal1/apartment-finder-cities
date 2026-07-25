import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { computeSubScores, normalizeWeights, scoreListing, MAX_COMMUTE } from '../lib/scoring';
import type { Listing, SearchCriteria, SubScores } from '../lib/types';

/**
 * How It Works — the scoring engine, explained.
 *
 * Everything numeric on this page is computed by importing the real scoring
 * module rather than by transcribing it into prose. If someone retunes
 * lib/scoring.ts, the worked example and the curves here move with it, so the
 * page can't quietly start lying about what the app does.
 */

/** The example search the page walks through. Deliberately ordinary. */
const EXAMPLE_CRITERIA: SearchCriteria = {
  city: 'San Francisco',
  inPerson: true,
  workAddress: '1 Market St',
  maxRent: 3500,
  bedrooms: 1,
  commuteMode: 'transit',
  weights: { commute: 0.7, price: 0.7, rating: 0.5, space: 0.4 },
};

const EXAMPLE_LISTING: Listing = {
  id: 'example',
  source: 'mock',
  listingUrl: '#',
  address: '1200 Fillmore St, Unit 4',
  neighborhood: 'Lower Haight',
  city: 'San Francisco',
  lat: 37.78,
  lng: -122.43,
  rentMonthly: 3100,
  bedrooms: 1,
  tags: [],
  ratingValue: 4.2,
  ratingSource: 'google',
};

const EXAMPLE_COMMUTE_MIN = 18;

const DIMENSIONS: Array<{
  key: keyof SubScores;
  label: string;
  rule: string;
  detail: string;
}> = [
  {
    key: 'commute',
    label: 'Commute',
    rule: `100 at the door, 0 at ${MAX_COMMUTE} minutes`,
    detail:
      "Door-to-door minutes from your work address, in the travel mode you picked. It falls off in a straight line, so every minute costs the same. Searching as remote? There's no journey to score, so commute sits out entirely.",
  },
  {
    key: 'price',
    label: 'Price',
    rule: 'Measures the headroom you keep',
    detail:
      "It isn't pass/fail against your cap — it's how much of your budget is left unspent, so half your cap scores about 52 and nine-tenths of it about 14. Past the cap that same line keeps falling, twice as steep, and bottoms out a few percent over. Going over budget can never improve a place's price fit.",
  },
  {
    key: 'rating',
    label: 'Rating',
    rule: 'Star rating, rescaled to 0–100',
    detail:
      'A 4.2-star building scores 84. Buildings we have no rating for sit at a neutral 60 rather than 0 — an unreviewed place is unknown, not bad, and zeroing it would bury every listing that simply lacks reviews.',
  },
  {
    key: 'space',
    label: 'Space',
    rule: 'Meets your bedroom count, or −40 each',
    detail:
      'Hitting or beating the bedrooms you asked for is full marks; there is no bonus for extra rooms you did not ask for. Each bedroom short of your target costs 40 points.',
  },
];

export default function HowItWorksView() {
  // The four sub-scores, the normalized weights, and the final score — all from
  // the same functions the results page runs.
  const sub = useMemo(
    () => computeSubScores(EXAMPLE_LISTING, EXAMPLE_CRITERIA, EXAMPLE_COMMUTE_MIN),
    []
  );
  const weights = useMemo(() => normalizeWeights(EXAMPLE_CRITERIA.weights), []);
  const total = useMemo(
    () => scoreListing(EXAMPLE_LISTING, EXAMPLE_CRITERIA, EXAMPLE_COMMUTE_MIN),
    []
  );

  return (
    <div className="space-y-14 pb-6 sm:space-y-20">
      {/* ---- Header ---- */}
      <header className="pt-4">
        <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
          <span className="h-[1.5px] w-[22px] bg-brand-600" />
          How it works
        </div>
        <h1 className="max-w-2xl text-4xl leading-[1.02] tracking-[-0.03em] text-slate-900 sm:text-[52px]">
          Every match score, fully shown
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
          Nester doesn't rank by whoever paid the most, and there's no black box. Each place is
          scored on four things you can check, then weighted by how much you said each one matters.
        </p>
      </header>

      {/* ---- The three steps ---- */}
      <section>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              n: '1',
              title: 'You set the weights',
              body: 'The sliders in the search wizard are the whole input. Push commute up and price down, and the ranking shifts to match — nothing else is tuning it behind you.',
            },
            {
              n: '2',
              title: 'Each place gets four scores',
              body: 'Commute, price, rating and space are each scored 0–100 on their own, using the rules below. No dimension can hide inside another.',
            },
            {
              n: '3',
              title: 'We take a weighted average',
              body: 'Your weights are scaled to sum to 1, then applied to the four scores. That single 0–100 number is what orders your results.',
            },
          ].map((s) => (
            <div key={s.n} className="card p-6">
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-brand-600 text-[13px] font-semibold text-brand-600">
                {s.n}
              </span>
              <h2 className="mt-4 text-lg text-slate-900">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- The four dimensions ---- */}
      <section>
        <h2 className="text-[32px] tracking-tight text-slate-900">The four dimensions</h2>
        <p className="mt-2.5 max-w-xl text-[15px] text-slate-500">
          Each is scored independently, before any weighting.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {DIMENSIONS.map((d) => (
            <div key={d.key} className="card p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-xl text-slate-900">{d.label}</h3>
                <span className="rounded-md bg-brand-100 px-2.5 py-0.5 text-[11px] text-brand-700">
                  0–100
                </span>
              </div>
              <p className="mt-1.5 text-[13px] font-medium text-brand-700">{d.rule}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">{d.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Worked example ---- */}
      <section>
        <h2 className="text-[32px] tracking-tight text-slate-900">A worked example</h2>
        <p className="mt-2.5 max-w-xl text-[15px] text-slate-500">
          Every number below is produced by the same code that ranks your real results.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {/* The inputs */}
          <div className="card p-6">
            <h3 className="text-[13px] uppercase tracking-[0.08em] text-slate-400">The search</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="City" value={EXAMPLE_CRITERIA.city} />
              <Row label="Budget" value={`$${EXAMPLE_CRITERIA.maxRent.toLocaleString()}/mo`} />
              <Row label="Bedrooms" value={`${EXAMPLE_CRITERIA.bedrooms}`} />
              <Row label="Commute mode" value="Transit, from 1 Market St" />
            </dl>

            <div className="hr my-6" />

            <h3 className="text-[13px] uppercase tracking-[0.08em] text-slate-400">The place</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Address" value={EXAMPLE_LISTING.address} />
              <Row label="Rent" value={`$${EXAMPLE_LISTING.rentMonthly.toLocaleString()}/mo`} />
              <Row label="Bedrooms" value={`${EXAMPLE_LISTING.bedrooms}`} />
              <Row label="Rating" value={`${EXAMPLE_LISTING.ratingValue} ★`} />
              <Row label="Commute" value={`${EXAMPLE_COMMUTE_MIN} min`} />
            </dl>
          </div>

          {/* The arithmetic */}
          <div className="card p-6">
            <h3 className="text-[13px] uppercase tracking-[0.08em] text-slate-400">The maths</h3>
            <div className="mt-5 space-y-5">
              {DIMENSIONS.map((d) => {
                const score = Math.round(sub[d.key]);
                const weight = weights[d.key];
                return (
                  <div key={d.key}>
                    <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-slate-700">{d.label}</span>
                      <span className="data text-xs text-slate-400">
                        {score} × {weight.toFixed(2)} ={' '}
                        <span className="text-slate-700">{(score * weight).toFixed(1)}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hr my-6" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-slate-700">Match score</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  The four weighted parts, added up and rounded.
                </div>
              </div>
              <div className="data text-[40px] leading-none tracking-[-0.02em] text-brand-700">
                {total}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Try the weights ---- */}
      <WeightPlayground />

      {/* ---- What we don't do ---- */}
      <section>
        <h2 className="text-[32px] tracking-tight text-slate-900">What the score isn't</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {[
            {
              title: 'Not paid placement',
              body: "Nobody can buy a higher score. We don't take listing fees, and we don't host listings or handle transactions — we link out to the source.",
            },
            {
              title: 'Not a verdict on quality',
              body: 'It measures fit against your inputs, nothing more. A 62 that matches your life beats a 91 that doesn’t, and the "why it matched" line tells you which is which.',
            },
            {
              title: 'Not the final word on cost',
              body: 'Rent is only part of it. The True Monthly Cost panel on each listing adds estimated utilities and commute so you can compare all-in.',
            },
          ].map((c) => (
            <div key={c.title} className="card p-6">
              <h3 className="text-base text-slate-900">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Close ---- */}
      <section className="text-center">
        <div className="hr mb-10" />
        <h2 className="text-[28px] tracking-tight text-slate-900">Ready to try it?</h2>
        <p className="mx-auto mt-2.5 max-w-md text-[15px] text-slate-500">
          Four questions, about thirty seconds, no account needed.
        </p>
        <Link to="/" className="btn-outline mt-7 px-6 py-3 text-[15px]">
          Start a search →
        </Link>
      </section>
    </div>
  );
}

/**
 * A live version of step 1: move the same four weights the wizard exposes and
 * watch the example's score move. It runs the real scorer, so this is not a
 * simulation of the ranking — it is the ranking.
 */
function WeightPlayground() {
  const [weights, setWeights] = useState(EXAMPLE_CRITERIA.weights);

  const { score, normalized } = useMemo(() => {
    const criteria = { ...EXAMPLE_CRITERIA, weights };
    return {
      score: scoreListing(EXAMPLE_LISTING, criteria, EXAMPLE_COMMUTE_MIN),
      normalized: normalizeWeights(weights),
    };
  }, [weights]);

  return (
    <section>
      <h2 className="text-[32px] tracking-tight text-slate-900">Move the weights yourself</h2>
      <p className="mt-2.5 max-w-xl text-[15px] text-slate-500">
        Same place, same rules — only your priorities change. This is the live scorer, not a mock-up.
      </p>

      <div className="card mt-8 grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          {DIMENSIONS.map((d) => {
            const value = weights[d.key];
            return (
              <div key={d.key}>
                <div className="mb-2 flex items-baseline justify-between text-sm">
                  <span className="text-slate-700">{d.label}</span>
                  <span className="data text-xs text-slate-400">
                    weight {value.toFixed(1)} → {(normalized[d.key] * 100).toFixed(0)}% of the score
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={value}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [d.key]: Number(e.target.value) }))
                  }
                  aria-label={`${d.label} weight`}
                  className="slider"
                  style={{ ['--pct' as string]: `${value * 100}%` }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-ink-600 p-6">
          <span className="text-[11px] uppercase tracking-[0.1em] text-slate-400">
            {EXAMPLE_LISTING.neighborhood} scores
          </span>
          <span className="data text-[64px] leading-none tracking-[-0.03em] text-brand-700">
            {score}
          </span>
          <span className="max-w-[22ch] text-center text-xs leading-relaxed text-slate-400">
            out of 100, for a search weighted exactly this way
          </span>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="flex-none text-slate-400">{label}</dt>
      <dd className="min-w-0 text-right text-slate-700">{value}</dd>
    </div>
  );
}
