import type { ReactNode } from 'react';

/**
 * The empty-state mark: a glyph on a raised disc with accent rings expanding
 * out of it. This is Nocturne's "accent as a glow rather than a flood" — the
 * only place the ground gets any real accent presence, and it stays a line.
 *
 * `rings={2}` staggers a second ring so the pulse reads as continuous; use it
 * on the fuller-page states and one ring on the smaller ones.
 */
export default function EmptyMark({
  size = 110,
  rings = 1,
  glow = false,
  children,
}: {
  size?: number;
  /** 1 or 2 — a second ring is offset in time for a slower double pulse. */
  rings?: 1 | 2;
  /** Fill the disc with an accent-into-surface gradient (the larger mark). */
  glow?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full border-[1.5px] border-brand-600 motion-safe:animate-pulsering" />
      {rings === 2 && (
        <span
          className="absolute inset-0 rounded-full border-[1.5px] border-brand-600 motion-safe:animate-pulsering"
          style={{ animationDelay: '0.9s' }}
        />
      )}
      <div
        className={`relative flex h-full w-full items-center justify-center rounded-full text-brand-700 shadow-soft ${
          glow ? 'bg-gradient-to-br from-brand-100 to-ink-800' : 'bg-ink-800'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/** House glyph, drawn as a line at the weight the mark carries it. */
export function HouseGlyph({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H17.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

/** Heart glyph for the shortlist's empty state. */
export function HeartGlyph({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.7-10-9.3C.4 7.6 2.4 4 6 4c2.2 0 3.8 1.2 6 3.8C14.2 5.2 15.8 4 18 4c3.6 0 5.6 3.6 4 7.2-2.5 4.6-10 9.3-10 9.3Z" />
    </svg>
  );
}
