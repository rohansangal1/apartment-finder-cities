import { useState } from 'react';

/** A review draft minus listingId (the parent supplies that on submit). */
export type ReviewDraft = {
  stars: number;
  text: string;
  livedHereVerified: boolean;
};

/**
 * Write-a-review form, shown only to signed-in users (gated by the parent).
 * `livedHereVerified` is self-declared here; in production it would be confirmed
 * against whether the user found the place through the platform.
 */
export default function ReviewForm({
  onSubmit,
}: {
  onSubmit: (draft: ReviewDraft) => Promise<void>;
}) {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  const [livedHere, setLivedHere] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 4) {
      setError('Please write a little more.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ stars, text: text.trim(), livedHereVerified: livedHere });
      setText('');
      setStars(5);
      setLivedHere(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post your review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-lg border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-700">Write a review</p>

      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="p-0.5"
          >
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill={n <= stars ? '#f59e0b' : '#e2e8f0'}>
              <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
            </svg>
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="What was it like living here?"
        className="input mt-2 resize-none"
      />

      <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={livedHere}
          onChange={(e) => setLivedHere(e.target.checked)}
          className="h-4 w-4 accent-brand-600"
        />
        I lived here
      </label>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? 'Posting…' : 'Post review'}
      </button>
    </form>
  );
}
