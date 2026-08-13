import { Fragment } from 'react';

/**
 * Renders the model's output: plain paragraphs, `- ` bullets, and `**bold**`.
 *
 * A deliberately tiny renderer rather than a markdown dependency. The prompt
 * asks for exactly these three constructs, and this runs on text that streams in
 * a character at a time — a full parser would spend most of its life choking on
 * half-written syntax. Everything is rendered as React children, never as HTML,
 * so a model that emits angle brackets prints them instead of injecting them.
 */
export default function NotesBody({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-slate-700">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const bullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const content = bullet ? trimmed.slice(2) : trimmed;

        return (
          <p key={i} className={bullet ? 'flex gap-2 pl-1' : undefined}>
            {bullet && <span className="text-brand-500" aria-hidden="true">·</span>}
            <span>{renderBold(content)}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Split on `**…**` and wrap the marked runs. Odd indices are the bold ones. */
function renderBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-slate-900">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}
