import { Link } from 'react-router-dom';
import type { ScoredListing } from '../lib/types';
import MatchScore from './MatchScore';
import Rating from './Rating';
import Tag from './Tag';
import SaveButton from './SaveButton';
import { formatRent, formatBeds, formatCommute, resolveListingUrl } from '../lib/format';

/**
 * Results-view card for one scored listing. Shows neighborhood/address, rent,
 * beds, estimated commute, rating, match score, key tags, the "why it matched"
 * line, and a "View listing" button that opens the source site.
 */
export default function ListingCard({
  scored,
  inPerson,
}: {
  scored: ScoredListing;
  inPerson: boolean;
}) {
  const { listing, matchScore, commuteMinutes, commuteMode, whyItMatched } = scored;
  const { url, isFallback } = resolveListingUrl(listing);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <MatchScore score={matchScore} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                to={`/listing/${listing.id}`}
                className="block truncate text-base font-semibold text-slate-900 hover:text-brand-600"
              >
                {listing.neighborhood}
              </Link>
              <p className="truncate text-sm text-slate-500">{listing.address}</p>
            </div>
            <SaveButton id={listing.id} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold text-slate-900">{formatRent(listing.rentMonthly)}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">{formatBeds(listing.bedrooms)}</span>
            {inPerson && (
              <>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">
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
              Original link expired — opens a search on the source site.
            </p>
          )}
        </div>
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
