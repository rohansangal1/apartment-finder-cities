import { Link } from 'react-router-dom';
import { useCompare } from '../context/compare-context';
import ListingVisual from './listing-visual';

/**
 * Fixed bottom bar summarizing the compare shortlist with mini thumbnails. Sits
 * above the mobile tab bar (bottom-16) and floats at bottom-4 on larger screens.
 * Hidden entirely when nothing is selected; "Compare" activates at ≥2 entries.
 */
export default function CompareTray() {
  const { entries, remove, clear } = useCompare();
  if (entries.length === 0) return null;

  const canCompare = entries.length >= 2;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-30 px-4 sm:bottom-4">
      <div className="pointer-events-auto mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-ink-600 bg-ink-800/95 p-2.5 shadow-soft-lg backdrop-blur motion-safe:animate-fadeup">
        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {entries.map((e) => (
            <div key={e.listing.id} className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg">
              <ListingVisual listing={e.listing} score={e.matchScore} />
              <button
                type="button"
                onClick={() => remove(e.listing.id)}
                aria-label={`Remove ${e.listing.neighborhood} from compare`}
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink-900/80 text-[10px] text-paper hover:bg-ink-900"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={clear}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
          {canCompare ? (
            <Link
              to="/compare"
              className="btn-outline rounded-lg px-3.5 py-2 text-sm"
            >
              Compare ({entries.length})
            </Link>
          ) : (
            <span className="rounded-lg bg-ink-700 px-3.5 py-2 text-sm font-semibold text-slate-500">
              Add 1 more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
