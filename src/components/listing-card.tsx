import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ScoredListing } from '../lib/types';
import ListingVisual from './listing-visual';
import MatchScore from './match-score';
import ScoreBreakdown from './score-breakdown';
import Rating from './rating';
import Tag from './tag';
import SaveButton from './save-button';
import { formatRent, formatBeds, formatCommute } from '../lib/format';
import { resolveListingUrl, isListingStale, isNycListing } from '../lib/listing-links';
import ListingLinks from './listing-links';
import AiNotesButton from './ai-notes-button';
import { allInMonthlyCost } from '../lib/true-cost';
import { affordability } from '../lib/affordability';
import type { DealScore } from '../lib/deal-score';

/**
 * Results-view card for one scored listing — a deliberately SCANNABLE summary.
 * A photo/generated visual header (match score + save overlaid) sits above a
 * short data stack: neighborhood/address, rent/beds/commute, a couple of price
 * signals, rating, key tags, and the one-line "why it matched".
 *
 * The denser detail — the full sub-score breakdown and the other-portal links —
 * isn't dropped, just tucked into a single collapsed <details> disclosure so the
 * card reads cleanly at a glance but the depth is one click away, in place.
 *
 * onHover/highlighted power the desktop list↔map hover-sync (a brand ring marks
 * the card whose pin is active); compareSlot injects the compare-mode toggle.
 */
export default function ListingCard({
  scored,
  inPerson,
  monthlyIncome,
  dealScore,
  onHover,
  highlighted = false,
  compareSlot,
}: {
  scored: ScoredListing;
  inPerson: boolean;
  /** When set, shows the affordability badge (rent vs the 30% rule). */
  monthlyIncome?: number;
  /** Optional rent-vs-median assessment from the Python endpoint (may be absent). */
  dealScore?: DealScore;
  onHover?: (id: string | null) => void;
  highlighted?: boolean;
  compareSlot?: ReactNode;
}) {
  const { listing, matchScore, commuteMinutes, commuteMode, whyItMatched, subScores } = scored;
  const isNyc = isNycListing(listing);
  const stale = isListingStale(listing);
  const { url, isFallback } = resolveListingUrl(listing, stale);
  const afford = affordability(listing.rentMonthly, monthlyIncome);
  // Carry the deal-score label to the detail page via router state, so a click
  // through shows the same claim without re-fetching. Deep links lack this and
  // simply show no badge — acceptable degradation.
  const linkState = dealScore ? { dealScoreLabel: dealScore.label } : undefined;
  const belowMedian = dealScore ? dealScore.pctVsMedian < 0 : false;

  return (
    <div
      onMouseEnter={onHover ? () => onHover(listing.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      className={`card overflow-hidden transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-soft-lg ${
        highlighted ? 'ring-2 ring-brand-500' : ''
      }`}
    >
      {/* Visual header */}
      <div className="relative h-32 sm:h-36">
        <Link to={`/listing/${listing.id}`} state={linkState} className="block h-full w-full">
          <ListingVisual listing={listing} score={matchScore} />
        </Link>
        <div className="pointer-events-none absolute bottom-2 left-2">
          <MatchScore score={matchScore} size="sm" />
        </div>
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          {compareSlot}
          <SaveButton
            listing={listing}
            className="bg-ink-900/70 text-paper backdrop-blur hover:bg-ink-900"
          />
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/listing/${listing.id}`}
              state={linkState}
              className="block truncate text-base font-semibold text-slate-900 hover:text-brand-700"
            >
              {/* Neighborhood when we truly have one; otherwise the city, since the
                  street address is already shown on the line below. */}
              {listing.neighborhood || listing.city}
            </Link>
            <p className="truncate text-sm text-slate-500">{listing.address}</p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="data font-semibold text-slate-900">
            {formatRent(listing.rentMonthly)}
          </span>
          <span className="text-slate-400">·</span>
          <span className="data text-slate-600">{formatBeds(listing.bedrooms)}</span>
          {inPerson && (
            <>
              <span className="text-slate-400">·</span>
              <span className="data text-slate-600">
                {formatCommute(commuteMinutes, commuteMode)}
              </span>
            </>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="data text-xs text-slate-400">
            ~{formatRent(allInMonthlyCost(scored))}/mo all-in
          </p>
          {afford && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${afford.className}`}
              title={afford.withinRule ? 'At or under the 30% rule' : 'Above the 30% rule'}
            >
              {afford.withinRule ? `Fits 30% rule · ${afford.pct}%` : afford.label}
            </span>
          )}
          {dealScore && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                belowMedian ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-100 text-slate-600'
              }`}
              title={dealScore.label}
            >
              {belowMedian
                ? `${Math.abs(dealScore.pctVsMedian)}% below median`
                : `${dealScore.pctVsMedian}% vs median`}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Rating value={listing.ratingValue} source={listing.ratingSource} />
          {listing.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {listing.tags.slice(0, 3).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 line-clamp-2 text-sm text-slate-500">
          <span className="font-medium text-slate-600">Why it matched:</span> {whyItMatched}
        </p>

        {/* Progressive disclosure: the score bars + alternate-site links are kept
            but collapsed, so the card stays clean and the depth is one tap away. */}
        <details className="group mt-3">
          <summary className="flex cursor-pointer select-none items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
            Score breakdown{isNyc ? ' & other sites' : ''}
            <svg
              className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="mt-3 space-y-3">
            <ScoreBreakdown subScores={subScores} commuteApplies={inPerson} compact />
            {isNyc && <ListingLinks listing={listing} isStale={stale} />}
          </div>
        </details>

        {/* AI notes: the trigger until a set exists, then the notes themselves
            (collapsed, so a card with notes stays as scannable as one without). */}
        <AiNotesButton listing={listing} variant="compact" className="mt-3" />

        <div className="mt-3 flex items-center gap-3">
          <Link
            to={`/listing/${listing.id}`}
            state={linkState}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Details
          </Link>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline ml-auto inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm"
          >
            View listing
            <ExternalIcon />
          </a>
        </div>
        {isFallback && (
          <p className="mt-1.5 text-right text-xs text-amber-600">
            {stale
              ? 'This listing may be gone — opens a rental search for this address.'
              : 'No direct link — opens a rental search for this address.'}
          </p>
        )}
      </div>
    </div>
  );
}

function ExternalIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
