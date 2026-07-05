import { Sparkles } from 'lucide-react';
import { AI_NOTES_ENABLED } from '../lib/ai-notes';

/**
 * "Generate notes" trigger for a saved listing — a placeholder for now.
 *
 * While AI_NOTES_ENABLED is false the button is genuinely disabled (no click
 * handler, no fake output) and wears a "Coming soon" pill. This is an *honest UI
 * state*: it advertises where the feature will live without pretending it works.
 * When the flag flips true, this component is the one place that lights up.
 */
export default function AiNotesButton() {
  const enabled = AI_NOTES_ENABLED;

  return (
    <button
      type="button"
      disabled={!enabled}
      aria-disabled={!enabled}
      title={enabled ? 'Generate AI notes for this listing' : 'AI notes are coming soon'}
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-80"
    >
      <Sparkles className="h-4 w-4 text-brand-500" aria-hidden="true" />
      Generate notes
      {!enabled && (
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-500">
          Coming soon
        </span>
      )}
    </button>
  );
}
