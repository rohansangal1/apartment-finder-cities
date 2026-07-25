import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Marks a surface that is built but not yet open. Used on Roommates and Agents,
 * which have working plumbing behind them but no real inventory — so the page
 * would otherwise read as broken rather than as early.
 *
 * The banner is the one accent-tinted ground in the app besides the wizard's
 * review card: a soft accent wash over the surface with an accent hairline, plus
 * a bloom in the top-right corner. Nocturne allows the accent this much presence
 * when it is carrying meaning; it stays a wash, never a flood.
 */
export default function ComingSoonBanner({
  title,
  children,
  eta,
}: {
  title: string;
  /** One or two sentences on what will land here and what already works. */
  children: ReactNode;
  /** Short, honest timing note — omit it rather than invent a date. */
  eta?: string;
}) {
  return (
    <section
      aria-labelledby="coming-soon-title"
      className="relative overflow-hidden rounded-2xl border border-brand-200 p-6 sm:p-8"
      style={{ background: 'color-mix(in srgb, #9184d9 8%, #232532)' }}
    >
      {/* Corner bloom — depth without a second surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full"
        style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, #9184d9 22%, transparent), transparent)' }}
      />

      <div className="relative flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-md bg-brand-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-brand-700">
          {/* A slow pulse reads as "in progress" without becoming a spinner. */}
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-700 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-700" />
          </span>
          Coming soon
        </span>
        {eta && <span className="text-xs text-slate-400">{eta}</span>}
      </div>

      <h2 id="coming-soon-title" className="relative mt-4 text-[25px] tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="relative mt-2.5 max-w-xl text-[15px] leading-relaxed text-slate-600">{children}</p>

      <div className="relative mt-6 flex flex-wrap gap-3">
        <Link to="/" className="btn-outline px-5 py-2.5">
          Find a place →
        </Link>
        <Link
          to="/how-it-works"
          className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:text-brand-700"
        >
          See how matching works
        </Link>
      </div>
    </section>
  );
}
