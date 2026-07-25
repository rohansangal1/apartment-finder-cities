/**
 * The wizard's progress rail: numbered circles joined by connectors, with
 * completed steps collapsing to a check. Circles are buttons — a user who has
 * already been through the flow can jump straight back to any step rather than
 * paging through it.
 *
 * Nocturne carries state in the accent as a line and a glow: the current step
 * is an outline with a soft ring, a done step is the one place the accent
 * fills, and everything ahead stays on the divider colour.
 */
export default function WizardSteps({
  labels,
  current,
  onJump,
}: {
  labels: string[];
  /** 1-based index of the active step. */
  current: number;
  onJump: (step: number) => void;
}) {
  return (
    <ol className="mb-9 flex flex-wrap items-center gap-y-3">
      {labels.map((label, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        const last = i === labels.length - 1;
        return (
          <li key={label} className={`flex items-center ${last ? 'flex-none' : 'flex-1'}`}>
            <button
              type="button"
              onClick={() => onJump(num)}
              aria-current={active ? 'step' : undefined}
              aria-label={`Step ${num}: ${label}`}
              className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border-[1.5px] text-[13px] font-semibold transition-transform duration-200 hover:scale-105 ${
                done
                  ? 'border-brand-600 bg-brand-600 text-ink-950'
                  : active
                  ? 'border-brand-600 text-brand-600'
                  : 'border-ink-600 text-slate-400'
              }`}
              style={
                active
                  ? { boxShadow: '0 0 0 4px color-mix(in srgb, #9184d9 18%, transparent)' }
                  : undefined
              }
            >
              {done ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5 9.5 18 20 6" />
                </svg>
              ) : (
                num
              )}
            </button>
            <span
              className={`ml-2.5 whitespace-nowrap text-sm ${
                done || active ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
            {/* The connector fills to the accent once the step behind it is done. */}
            {!last && (
              <span
                className={`mx-5 hidden h-[1.5px] min-w-[36px] flex-1 sm:block ${
                  done ? 'bg-brand-600' : 'bg-ink-600'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
