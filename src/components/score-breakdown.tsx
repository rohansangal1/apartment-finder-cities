import type { SubScores } from '../lib/types';

/**
 * Renders the four 0–100 sub-scores behind a match score as labeled bars, so the
 * aggregate is legible ("why is this an 82?"). Color grading matches MatchScore
 * walking down the accent ramp (≥80 brightest, then base, then dimmed, else a
 * neutral) — Nocturne takes contrast from the tonal ramps, not from hue, so the
 * bars stay one family instead of becoming a traffic light.
 *
 * When the search is remote, the commute dimension doesn't apply — computeSubScores
 * fills it with a neutral 100, which would mislead — so callers pass
 * commuteApplies=false and we render it greyed as "N/A" instead of a full bar.
 */

const DIMENSIONS: Array<{ key: keyof SubScores; label: string }> = [
  { key: 'commute', label: 'Commute' },
  { key: 'price', label: 'Price' },
  { key: 'rating', label: 'Rating' },
  { key: 'space', label: 'Space' },
];

function barColor(score: number): string {
  if (score >= 80) return 'bg-brand-700';
  if (score >= 60) return 'bg-brand-600';
  if (score >= 40) return 'bg-brand-300';
  return 'bg-slate-300';
}

export default function ScoreBreakdown({
  subScores,
  commuteApplies = true,
  compact = false,
}: {
  subScores: SubScores;
  commuteApplies?: boolean;
  compact?: boolean;
}) {
  const commuteNA = !commuteApplies;

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      {DIMENSIONS.map(({ key, label }, i) => {
        const score = Math.round(subScores[key]);
        const isNA = key === 'commute' && commuteNA;
        return (
          <div key={key} className="flex items-center gap-2">
            <span
              className={`${compact ? 'w-14 text-xs' : 'w-16 text-sm'} shrink-0 font-medium text-slate-500`}
            >
              {label}
            </span>
            <div
              className={`flex-1 overflow-hidden rounded-full bg-slate-100 ${compact ? 'h-1.5' : 'h-2'}`}
            >
              {!isNA && (
                <div
                  className={`h-full origin-left rounded-full motion-safe:animate-growbar ${barColor(score)}`}
                  style={{ width: `${score}%`, animationDelay: `${i * 90}ms` }}
                />
              )}
            </div>
            <span
              className={`${compact ? 'w-8 text-xs' : 'w-9 text-sm'} shrink-0 text-right font-mono tabular-nums ${
                isNA ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {isNA ? 'N/A' : score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
