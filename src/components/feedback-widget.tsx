import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { Field } from './form-controls';
import { useDialog, CloseIcon } from './welcome-modal';
import {
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  MAX_FEEDBACK_LEN,
  MAX_CONTACT_EMAIL_LEN,
} from '../lib/contact';

/**
 * Always-available way to reach the author: a pill pinned to the bottom-right of
 * every page that springs open a short feedback form.
 *
 * Submissions POST to /api/feedback (no auth — a visitor shouldn't have to sign
 * up to tell me something's broken). If that endpoint is unconfigured or fails,
 * we surface the error *and* a mailto fallback so the feedback isn't just lost.
 */
const BASE = import.meta.env?.VITE_API_BASE_URL || '';

/** How long the thank-you state lingers before the panel closes itself. */
const THANKS_MS = 2500;

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  // Stable so the panel's auto-close timer isn't reset by unrelated re-renders.
  const close = useCallback(() => setOpen(false), []);
  useDialog(open, close);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={false}
          // Above the z-20 mobile tab bar on phones, clear of everything on desktop.
          className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-soft-lg transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 sm:bottom-6 sm:right-6"
        >
          <ChatIcon className="h-4 w-4" />
          Contact me
        </button>
      )}
      {open && <FeedbackPanel onClose={close} />}
    </>
  );
}

function FeedbackPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messageRef.current?.focus();
  }, []);

  // Let the thank-you state read for a beat, then get out of the way.
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(onClose, THANKS_MS);
    return () => clearTimeout(t);
  }, [sent, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 4) {
      setError('Please write a little more.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          email: email.trim(),
          path: pathname,
        }),
      });
      if (!res.ok) {
        let detail = `Request failed: ${res.status}`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) detail = data.error;
        } catch {
          /* non-JSON error body */
        }
        throw new Error(detail);
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-sm motion-safe:animate-fadein"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(e) => e.stopPropagation()}
        // Bottom sheet on phones; a panel springing from the button's corner on desktop.
        className="card absolute inset-x-4 bottom-24 origin-bottom-right border border-ink-600 p-5 shadow-soft-lg motion-safe:animate-popin sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-96"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-ink-700 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        {sent ? (
          <div className="py-6 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <CheckIcon className="h-6 w-6" />
            </span>
            <h2 id="feedback-title" className="mt-3 font-serif text-xl text-slate-900">
              Thanks — got it
            </h2>
            <p className="mt-1 text-sm text-slate-500">I read every one of these.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 id="feedback-title" className="pr-8 font-serif text-xl text-slate-900">
              Say hi
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Nester's still being built, and what you send genuinely shapes what I work on next.
            </p>

            <textarea
              ref={messageRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={MAX_FEEDBACK_LEN}
              placeholder="Suggestions, feedback, ideas for what to build next — or just a question. All of it's welcome."
              className="input mt-3 resize-none"
            />
            <p className="mt-1 text-right text-xs text-slate-400 tabular-nums">
              {message.length}/{MAX_FEEDBACK_LEN}
            </p>

            <div className="mt-2">
              <Field label="Your email (optional — only so I can reply)">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={MAX_CONTACT_EMAIL_LEN}
                  placeholder="you@example.com"
                  className="input"
                />
              </Field>
            </div>

            {error && (
              <p className="mt-2 text-xs text-rose-600">
                {error}{' '}
                <a href={CONTACT_MAILTO} className="underline underline-offset-2">
                  Email me directly instead
                </a>
                .
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
            >
              {submitting ? 'Sending…' : 'Send'}
            </button>

            <p className="mt-3 text-center text-xs text-slate-400">
              Or reach me at{' '}
              <a
                href={CONTACT_MAILTO}
                className="text-brand-700 underline underline-offset-2 hover:text-brand-500"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// ---- icons ----
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.6-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
