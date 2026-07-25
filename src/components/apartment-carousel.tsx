import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * <ApartmentCarousel /> — a rotating "featured spaces" gallery for the landing
 * page. Auto-advances, pauses on hover, crossfades between slides, and exposes
 * arrow + dot controls.
 *
 * NOTE: these are stock/marketing photos shown purely for visual flavor — they
 * carry no captions (no location, price, or beds) so nothing implies a real,
 * specific listing. Listing cards use the unit's own imagery or a placeholder.
 */
const SLIDES: string[] = [
  '/images/apt-penthouse.jpg',
  '/images/apt-loft.jpg',
  '/images/apt-studio.jpg',
  '/images/skyline-river.jpg',
  '/images/brooklyn-bridge.jpg',
];

const ADVANCE_MS = 4500;
const FADE_MS = 700;

export default function ApartmentCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = SLIDES.length;

  const go = useCallback((next: number) => setIndex((next + count) % count), [count]);
  const prev = useCallback(() => go(index - 1), [go, index]);
  const next = useCallback(() => go(index + 1), [go, index]);

  // Auto-advance, paused on hover/focus. Restarts whenever index changes so a
  // manual nav gives a full dwell on the chosen slide.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (paused) return;
    timer.current = window.setTimeout(() => go(index + 1), ADVANCE_MS);
    return () => window.clearTimeout(timer.current);
  }, [index, paused, go]);

  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden rounded-3xl bg-ink-800 shadow-soft-lg sm:aspect-[16/7]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured apartment spaces"
    >
      {/* Slides (crossfade via stacked, opacity-animated layers) */}
      {SLIDES.map((url, i) => {
        const active = i === index;
        return (
          <img
            key={url}
            src={url}
            alt=""
            aria-hidden={!active}
            className="absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out"
            style={{ opacity: active ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
            loading={i === 0 ? 'eager' : 'lazy'}
            draggable={false}
          />
        );
      })}

      {/* Prev / next arrows */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-paper-cream/90 p-2.5 text-slate-700 shadow-soft backdrop-blur transition hover:bg-paper-cream hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-paper-cream/90 p-2.5 text-slate-700 shadow-soft backdrop-blur transition hover:bg-paper-cream hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Dot indicators */}
      <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-2">
        {SLIDES.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => go(i)}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index}
            className={`h-1.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              i === index ? 'w-6 bg-brand-700' : 'w-1.5 bg-slate-300 hover:bg-slate-500'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
