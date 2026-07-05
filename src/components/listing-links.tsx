import type { Listing } from '../lib/types';
import { buildListingLinks } from '../lib/listing-links';

/**
 * A compact "View on: Zillow · StreetEasy · Leasebreak" row of outbound links.
 *
 * Renders one text link per site from buildListingLinks() (Zillow everywhere,
 * StreetEasy + Leasebreak for NYC listings). Every link is target="_blank" with
 * rel="noopener noreferrer" — `noopener` stops the opened tab from reaching back
 * to our page via window.opener (a reverse-tabnabbing risk), and `noreferrer`
 * withholds the Referer header. Both are the standard hygiene for user-generated
 * or third-party outbound links.
 */
export default function ListingLinks({
  listing,
  isStale,
  className = '',
}: {
  listing: Listing;
  isStale: boolean;
  className?: string;
}) {
  const links = buildListingLinks(listing, isStale);
  if (links.length === 0) return null;

  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-400 ${className}`}>
      <span>View on:</span>
      {links.map((link, i) => (
        <span key={link.site} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">·</span>}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-500 underline-offset-2 hover:text-brand-600 hover:underline"
          >
            {link.label}
          </a>
        </span>
      ))}
    </p>
  );
}
