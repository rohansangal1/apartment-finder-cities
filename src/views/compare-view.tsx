import { Link } from 'react-router-dom';
import { useCompare } from '../context/compare-context';
import { useUserData } from '../context/user-data-context';
import type { ScoredListing } from '../lib/types';
import ListingVisual from '../components/listing-visual';
import MatchScore from '../components/match-score';
import ScoreBreakdown from '../components/score-breakdown';
import Rating from '../components/rating';
import Tag from '../components/tag';
import { formatRent, formatBeds, formatCommute } from '../lib/format';
import { allInMonthlyCost } from '../lib/true-cost';

/**
 * Side-by-side comparison of the compare shortlist (2–3 listings). One column per
 * listing, a sticky row-label column on the left, and best-in-row values tinted
 * so the winner on each dimension (cheapest, shortest commute, highest score…)
 * is obvious at a glance. Below 2 entries the table is meaningless, so we guard.
 */
export default function CompareView() {
  const { entries, remove } = useCompare();
  const { savedListings } = useUserData();

  if (entries.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center motion-safe:animate-fadeup">
        <span className="text-4xl">⚖️</span>
        <h1 className="mt-3 font-serif text-2xl font-semibold text-slate-900">Nothing to compare yet</h1>
        <p className="mt-1 max-w-xs text-sm text-slate-500">
          Add at least two listings to compare them side by side — use the “Compare” pill on any
          result or saved place.
        </p>
        <Link
          to="/results"
          className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Back to results
        </Link>
      </div>
    );
  }

  // Notes come from the user's saved snapshots (only present for saved listings).
  const noteById = new Map(savedListings.map((s) => [s.listing.id, s.note]));

  // Best-in-row targets. Commute only counts entries where it actually applies.
  const bestRent = Math.min(...entries.map((e) => e.listing.rentMonthly));
  const bestAllIn = Math.min(...entries.map((e) => allInMonthlyCost(e)));
  const bestScore = Math.max(...entries.map((e) => e.matchScore));
  const commuteVals = entries.filter((e) => e.commuteApplies).map((e) => e.commuteMinutes);
  const bestCommute = commuteVals.length ? Math.min(...commuteVals) : null;
  const ratingVals = entries
    .map((e) => e.listing.ratingValue)
    .filter((v): v is number => v != null);
  const bestRating = ratingVals.length ? Math.max(...ratingVals) : null;

  return (
    <div className="space-y-4">
      <header className="pt-2">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">Compare</h1>
        <p className="mt-1 text-sm text-slate-500">
          {entries.length} listings, side by side. Best-in-row values are highlighted.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-28 bg-paper-canvas p-2 text-left align-bottom" />
              {entries.map((e) => (
                <th key={e.listing.id} className="min-w-[13rem] p-2 align-bottom">
                  <ColumnHeader entry={e} onRemove={() => remove(e.listing.id)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Rent">
              {entries.map((e) => (
                <Cell key={e.listing.id} best={e.listing.rentMonthly === bestRent}>
                  <span className="data font-semibold text-slate-900">
                    {formatRent(e.listing.rentMonthly)}
                  </span>
                </Cell>
              ))}
            </Row>
            <Row label="All-in / mo">
              {entries.map((e) => (
                <Cell key={e.listing.id} best={allInMonthlyCost(e) === bestAllIn}>
                  <span className="data text-slate-700">~{formatRent(allInMonthlyCost(e))}</span>
                </Cell>
              ))}
            </Row>
            <Row label="Beds">
              {entries.map((e) => (
                <Cell key={e.listing.id}>
                  <span className="data text-slate-700">{formatBeds(e.listing.bedrooms)}</span>
                </Cell>
              ))}
            </Row>
            <Row label="Commute">
              {entries.map((e) => (
                <Cell
                  key={e.listing.id}
                  best={e.commuteApplies && bestCommute != null && e.commuteMinutes === bestCommute}
                >
                  {e.commuteApplies ? (
                    <span className="data text-slate-700">
                      {formatCommute(e.commuteMinutes, e.commuteMode)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </Cell>
              ))}
            </Row>
            <Row label="Rating">
              {entries.map((e) => (
                <Cell
                  key={e.listing.id}
                  best={e.listing.ratingValue != null && e.listing.ratingValue === bestRating}
                >
                  <Rating value={e.listing.ratingValue} source={e.listing.ratingSource} />
                </Cell>
              ))}
            </Row>
            <Row label="Match">
              {entries.map((e) => (
                <Cell key={e.listing.id} best={e.matchScore === bestScore}>
                  <span className="data font-semibold text-slate-900">{e.matchScore}</span>
                </Cell>
              ))}
            </Row>
            <Row label="Breakdown">
              {entries.map((e) => (
                <Cell key={e.listing.id}>
                  <ScoreBreakdown subScores={e.subScores} commuteApplies={!!e.commuteApplies} compact />
                </Cell>
              ))}
            </Row>
            <Row label="Tags">
              {entries.map((e) => (
                <Cell key={e.listing.id}>
                  <div className="flex flex-wrap gap-1">
                    {e.listing.tags.length ? (
                      e.listing.tags.map((t) => <Tag key={t}>{t}</Tag>)
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </Cell>
              ))}
            </Row>
            <Row label="Note">
              {entries.map((e) => (
                <Cell key={e.listing.id}>
                  {noteById.get(e.listing.id) ? (
                    <span className="whitespace-pre-wrap text-slate-600">
                      {noteById.get(e.listing.id)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </Cell>
              ))}
            </Row>
          </tbody>
        </table>
      </div>

      <div className="text-center">
        <Link to="/results" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Back to results
        </Link>
      </div>
    </div>
  );
}

function ColumnHeader({ entry, onRemove }: { entry: ScoredListing; onRemove: () => void }) {
  const { listing, matchScore } = entry;
  return (
    <div className="space-y-2">
      <div className="relative h-24 overflow-hidden rounded-xl">
        <ListingVisual listing={listing} score={matchScore} />
        <div className="pointer-events-none absolute bottom-1.5 left-1.5">
          <MatchScore score={matchScore} size="sm" />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${listing.neighborhood} from compare`}
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink-900/80 text-xs text-paper hover:bg-ink-900"
        >
          ✕
        </button>
      </div>
      <Link
        to={`/listing/${listing.id}`}
        className="block truncate font-semibold text-slate-900 hover:text-brand-700"
      >
        {listing.neighborhood}
      </Link>
      <p className="truncate text-xs font-normal text-slate-500">{listing.address}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 border-t border-slate-200 bg-paper-canvas p-2 text-left align-top text-xs font-semibold uppercase tracking-wide text-slate-400"
      >
        {label}
      </th>
      {children}
    </tr>
  );
}

function Cell({ children, best = false }: { children: React.ReactNode; best?: boolean }) {
  return (
    <td className={`border-t border-slate-200 p-2 align-top ${best ? 'rounded bg-brand-50' : ''}`}>
      {children}
    </td>
  );
}
