/** Circular 0–100 match-score badge, color-graded by strength. */
export default function MatchScore({
  score,
  size = 'md',
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const color =
    score >= 80
      ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
      : score >= 60
      ? 'bg-brand-50 text-brand-700 ring-brand-100'
      : score >= 40
      ? 'bg-amber-100 text-amber-700 ring-amber-200'
      : 'bg-slate-100 text-slate-500 ring-slate-200';

  const sizing =
    size === 'lg'
      ? 'h-16 w-16 text-2xl'
      : size === 'sm'
      ? 'h-10 w-10 text-sm'
      : 'h-12 w-12 text-base';

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-full font-bold ring-2 ${color} ${sizing}`}
      title={`Match score: ${score} out of 100`}
      aria-label={`Match score ${score} out of 100`}
    >
      <span className="leading-none">{score}</span>
    </div>
  );
}
