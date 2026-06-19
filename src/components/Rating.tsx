import { ratingSourceLabel } from '../lib/format';

/**
 * Star rating out of 5. If value is null we show "Not enough info" — we never
 * fabricate a number when data is too sparse.
 */
export default function Rating({
  value,
  source,
  showSource = false,
  size = 'sm',
}: {
  value: number | null;
  source: string | null;
  showSource?: boolean;
  size?: 'sm' | 'md';
}) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
        <StarIcon className="h-3.5 w-3.5" filled={false} />
        Not enough info
      </span>
    );
  }

  const dim = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const full = Math.floor(value);
  const hasHalf = value - full >= 0.5;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <StarIcon key={i} className={dim} filled={i < full} half={i === full && hasHalf} />
        ))}
      </span>
      <span className="text-sm font-semibold text-slate-700">{value.toFixed(1)}</span>
      {showSource && source && (
        <span className="text-xs text-slate-400">· {ratingSourceLabel(source)}</span>
      )}
    </span>
  );
}

function StarIcon({
  className,
  filled,
  half,
}: {
  className: string;
  filled: boolean;
  half?: boolean;
}) {
  const id = `half-${Math.random().toString(36).slice(2)}`;
  return (
    <svg className={className} viewBox="0 0 20 20">
      {half && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
        fill={half ? `url(#${id})` : filled ? '#f59e0b' : '#e2e8f0'}
      />
    </svg>
  );
}
