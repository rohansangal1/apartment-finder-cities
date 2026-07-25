import { useEffect, useState } from 'react';

/** Circular 0–100 match-score badge as an animated SVG progress ring, color-graded
 * by strength. Same API/thresholds as before; the ring fills on mount (and resets
 * to its final value instantly under prefers-reduced-motion via the global CSS
 * kill switch, which zeroes the transition duration). */

function band(score: number) {
  if (score >= 80) return { stroke: '#b5abfc', text: 'text-brand-700' };
  if (score >= 60) return { stroke: '#9184d9', text: 'text-brand-600' };
  if (score >= 40) return { stroke: '#796cbf', text: 'text-brand-300' };
  return { stroke: '#75798c', text: 'text-slate-400' };
}

export default function MatchScore({
  score,
  size = 'md',
}: {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { stroke, text } = band(score);
  // Animate the ring from empty to `score` after mount.
  const [offset, setOffset] = useState(100);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOffset(100 - Math.max(0, Math.min(100, score))));
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const dims =
    size === 'lg' ? 'h-16 w-16 text-2xl' : size === 'sm' ? 'h-10 w-10 text-xs' : 'h-12 w-12 text-base';
  const strokeW = size === 'lg' ? 3 : 4;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-ink-900/80 ${dims}`}
      title={`Match score: ${score} out of 100`}
      aria-label={`Match score ${score} out of 100`}
    >
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke="#3f424d"
          strokeWidth={strokeW}
          pathLength={100}
        />
        <circle
          cx="18"
          cy="18"
          r="16"
          fill="none"
          stroke={stroke}
          strokeWidth={strokeW}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <span className={`relative font-mono font-bold leading-none tabular-nums ${text}`}>{score}</span>
    </div>
  );
}
