import { useEffect, useRef, useState } from 'react';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '../lib/contact';

/**
 * First-arrival notice: says plainly that Nester is still being built, lists the
 * known gaps, and invites feedback. Shown once per browser session
 * (sessionStorage, not localStorage) — enough to catch every visit without
 * nagging on every route change.
 *
 * Dismissing it doesn't destroy it: the notice collapses into a small floating
 * "!" button that reopens it. The caveats below (demo data, broken links) are
 * things a user hits mid-session, well after they've clicked past the modal, so
 * there has to be a way back to them.
 *
 * This is the app's first dialog, so it also sets the overlay conventions:
 * backdrop + panel at z-50 (above the z-30 compare tray), Escape / backdrop /
 * ✕ / primary-button all dismiss, and the page behind is scroll-locked.
 */
const WELCOME_KEY = 'nestle.welcome.v1';

/**
 * Shared dialog behavior: Escape to close and a background scroll lock while
 * open. Exported so FeedbackWidget gets identical semantics instead of its own
 * near-copy of these two effects.
 */
export function useDialog(open: boolean, onClose: () => void) {
  // Held in a ref so callers can pass an inline closure without the effect
  // tearing down and rebuilding the scroll lock on every render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
}

export default function WelcomeModal() {
  // Read the flag during the initial render (not in an effect) so a returning
  // visitor never sees the modal flash before it's dismissed. Storage can throw
  // in private mode / with cookies disabled — there, we just show the notice.
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(WELCOME_KEY) !== 'seen';
    } catch {
      return true;
    }
  });
  const closeRef = useRef<HTMLButtonElement>(null);

  const dismiss = () => {
    try {
      sessionStorage.setItem(WELCOME_KEY, 'seen');
    } catch {
      /* storage unavailable — the notice simply returns next navigation */
    }
    setOpen(false);
  };

  useDialog(open, dismiss);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Collapsed state: the notice lives on as a floating badge instead of
  // disappearing. Sits below the sticky z-20 top bar rather than over it, so it
  // never covers the Account button on desktop.
  if (!open) {
    return (
      // The entrance and the bounce are two different animations on one
      // element, and CSS only honours one `animation` per element — so the
      // wrapper owns the pop-in and the button owns the looping bounce.
      <div className="fixed right-4 top-20 z-40 motion-safe:animate-popin sm:right-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Show the work-in-progress notice"
          title="Work in progress — read the notice"
          // No backdrop-blur here: a backdrop-filter on a transform-animated
          // element doesn't get repainted each frame, so the bounce only
          // appeared on hover (when a colour change forced a repaint). The fill
          // is opaque, so the blur was invisible anyway. transition-colors, not
          // transition, keeps the hover tween off `transform` for the same
          // reason.
          className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/40 bg-ink-900 text-amber-500 shadow-soft-lg transition-colors will-change-transform hover:border-amber-500/70 hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-brand-500 motion-safe:animate-nudge"
        >
          <AlertIcon className="h-7 w-7" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 px-4 backdrop-blur-sm motion-safe:animate-fadein"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        // The backdrop closes on click; the panel must not forward its own.
        onClick={(e) => e.stopPropagation()}
        className="card relative w-full max-w-md border border-ink-600 p-6 shadow-soft-lg motion-safe:animate-popin"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-ink-700 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Heads up</p>
        <h2 id="welcome-title" className="mt-1 text-2xl text-slate-900">
          Nester is a work in progress
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          I'm actively building this, so expect rough edges and things that aren't finished yet.
          I'd genuinely love your feedback — what's confusing, what's missing, and what you'd
          want built next.
        </p>
        <div className="mt-4 rounded-lg border border-ink-600 bg-ink-900/40 p-3.5">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-500">
            A couple of things to note
          </p>
          <ul className="mt-2.5 space-y-2 text-sm leading-relaxed text-slate-600">
            <li className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>
                <span className="font-medium text-slate-800">Many links are currently broken.</span>{' '}
                Links out to listings, sources, and agents may not resolve yet — I'm actively
                fixing them.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>
                <span className="font-medium text-slate-800">Listings are demo data.</span>{' '}
                Everything you see is sample data used to build and test the matching engine — not
                live inventory. Prices, ratings, and availability aren't real.
              </span>
            </li>
          </ul>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Use the <span className="font-medium text-slate-800">Contact me</span> button in the
          bottom-right corner of any page, or email me directly at{' '}
          <a
            href={CONTACT_MAILTO}
            className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-500"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="btn-outline mt-5 w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          Got it — let me look around
        </button>
      </div>
    </div>
  );
}

// ---- icons ----
/** Exclamation mark for the collapsed notice badge. */
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6v8" />
      <path d="M12 18h.01" />
    </svg>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
