import type { ScoredListing } from '../lib/types';
import { useCompare } from '../context/compare-context';

/**
 * Small pill that adds/removes a listing from the compare shortlist. Used as the
 * card's compareSlot on results and inline on saved rows. Disabled (with a
 * tooltip) when the shortlist is full and this listing isn't already in it.
 */
export default function CompareToggle({
  entry,
  className = '',
}: {
  entry: ScoredListing;
  className?: string;
}) {
  const { isSelected, isFull, toggle } = useCompare();
  const selected = isSelected(entry.listing.id);
  const disabled = isFull && !selected;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(entry);
      }}
      disabled={disabled}
      aria-pressed={selected}
      title={
        disabled
          ? 'Compare is full (3 max) — remove one to add this'
          : selected
          ? 'Remove from compare'
          : 'Add to compare'
      }
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
        selected
          ? 'text-brand-600 shadow-[inset_0_0_0_1px_#9184d9]'
          : disabled
          ? 'cursor-not-allowed bg-ink-900/70 text-slate-500'
          : 'bg-ink-900/70 text-paper backdrop-blur hover:bg-ink-900'
      } ${className}`}
    >
      <CompareIcon />
      {selected ? 'Comparing' : 'Compare'}
    </button>
  );
}

function CompareIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 7l3-3M4 7l3 3M20 17H4m16 0-3-3m3 3-3 3" />
    </svg>
  );
}
