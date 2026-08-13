import { useEffect, useRef, useState } from 'react';
import { Sparkles, Check, Loader2, X } from 'lucide-react';
import type { Listing } from '../lib/types';
import { streamNotes, type AiNotes } from '../lib/ai-notes';
import { useUserData } from '../context/user-data-context';
import { useSearch } from '../context/search-context';
import { useDialog } from './welcome-modal';
import NotesBody from './ai-notes-body';

/**
 * The "generate notes" side panel: a chat-shaped transcript of one run.
 *
 * It's a transcript rather than a conversation on purpose — notes are generated
 * once per listing, so there's no follow-up turn to type into. What the chat
 * framing buys is honesty about latency: a run takes several seconds of real
 * lookups, and showing each one as it happens beats a spinner.
 *
 * Every step line arrives from the server at the moment that lookup fires (see
 * api/_lib/ai/tools.ts). Nothing here is on a timer.
 *
 * Layout mirrors feedback-widget.tsx: full-height sheet on phones, a right-hand
 * drawer on desktop, backdrop at z-50 per the convention in welcome-modal.tsx.
 */
export default function AiNotesPanel({
  listing,
  onClose,
}: {
  listing: Listing;
  onClose: () => void;
}) {
  const { saveAiNotes } = useUserData();
  const { criteria } = useSearch();
  useDialog(true, onClose);

  const [steps, setSteps] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [result, setResult] = useState<AiNotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // One run per mount. The abort controller matters: closing the panel mid-run
  // must actually stop the request, not leave it writing into a dead component.
  useEffect(() => {
    const controller = new AbortController();
    streamNotes(
      listing,
      {
        // Only pass a work address when the search actually used one — the
        // server withholds the commute tool entirely without it.
        workAddress: criteria.inPerson ? criteria.workAddress : undefined,
        commuteMode: criteria.commuteMode,
        signal: controller.signal,
      },
      (event) => {
        if (event.type === 'step') setSteps((cur) => [...cur, event.label]);
        else if (event.type === 'reset') setText('');
        else setText((cur) => cur + event.text);
      }
    )
      .then(setResult)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not generate notes.');
      });
    return () => controller.abort();
    // Deliberately runs once: re-running on a criteria change would restart the
    // generation under the user mid-stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the newest line in view as steps and prose stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [steps, text]);

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await saveAiNotes(listing.id, result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save these notes.');
      setSaving(false);
    }
  };

  const done = Boolean(result);
  const label = listing.address || listing.neighborhood || listing.city;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-sm motion-safe:animate-fadein"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-notes-title"
        onClick={(e) => e.stopPropagation()}
        className="card absolute inset-x-0 bottom-0 top-16 flex flex-col border border-ink-600 p-5 shadow-soft-lg motion-safe:animate-fadeup sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[26rem] sm:rounded-r-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="ai-notes-title" className="flex items-center gap-2 font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" />
            Notes for this place
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 rounded p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
          {/* The seeded prompt. Shown as the user's turn because it is the
              request they made by pressing the button. */}
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-brand-500/15 px-3 py-2 text-sm text-slate-800">
            Generate notes for {label}
          </p>

          {steps.map((step, i) => {
            // The last step is still running unless the whole run has finished.
            const running = !done && !error && i === steps.length - 1;
            return (
              <p key={`${step}-${i}`} className="flex items-center gap-2 text-sm text-slate-500">
                {running ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                )}
                {step}
              </p>
            );
          })}

          {text && (
            <div className="rounded-2xl rounded-bl-sm bg-ink-900/60 px-3 py-2.5">
              <NotesBody text={text} />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
              {error}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-ink-600 pt-4">
          {done ? (
            <>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="btn-outline flex-1 px-4 py-2 text-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save to this listing'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                Discard
              </button>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              {error
                ? 'Nothing was saved — close and try again.'
                : `Written by Gemma 4 from live lookups. This takes a few seconds.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
