import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ScoredListing } from '../lib/types';
import ListingVisual from './listing-visual';
import MatchScore from './match-score';
import ScoreBreakdown from './score-breakdown';
import Rating from './rating';
import Tag from './tag';
import SaveButton from './save-button';
import {
  formatRent,
  formatBeds,
  formatCommute,
  resolveListingUrl,
  isListingStale,
} from '../lib/format';

/**
 * Results-view card for one scored listing. A photo/generated visual header
 * (with the match score and save control overlaid) sits above the data stack:
 * neighborhood/address, rent, beds, estimated commute, rating, match breakdown,
 * key tags, the "why it matched" line, and links out to the source site.
 *
 * onHover/highlighted power the desktop list↔map hover-sync (a brand ring marks
 * the card whose pin is active); compareSlot injects the compare-mode toggle.
 */
export default function ListingCard({
  scored,
  inPerson,
  onHover,
  highlighted = false,
  compareSlot,
}: {
  scored: ScoredListing;
  inPerson: boolean;
  onHover?: (id: string | null) => void;
  highlighted?: boolean;
  compareSlot?: ReactNode;
}) {
  const { listing, matchScore, commuteMinutes, commuteMode, whyItMatched, subScores } = scored;
  const stale = isListingStale(listing);
  const { url, isFallback } = resolveListingUrl(listing, stale);

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
        <Link to={`/listing/${listing.id}`} className="block h-full w-full">
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
              className="block truncate text-base font-semibold text-slate-900 hover:text-brand-700"
            >
              {listing.neighborhood}
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

        <div className="mt-2">
          <Rating value={listing.ratingValue} source={listing.ratingSource} />
        </div>

        {listing.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {listing.tags.slice(0, 4).map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}

        <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <span className="font-medium">Why it matched:</span> {whyItMatched}
        </p>

        <div className="mt-3">
          <ScoreBreakdown subScores={subScores} commuteApplies={inPerson} compact />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Link
            to={`/listing/${listing.id}`}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Details
          </Link>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
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
