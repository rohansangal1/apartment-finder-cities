import { useSearchParams } from 'react-router-dom';
import RoommatesView from './roommates-view';
import AgentsView from './agents-view';

/**
 * Connect — the grouped home for the social layer. Keeps the mobile bottom bar at a
 * reasonable tab count by folding Roommates + Agents behind one "Connect" tab, split
 * by a segmented control. The active section is in the URL (?tab=agents) so it's
 * linkable and survives refresh. Desktop links straight to /roommates and /agents.
 */
export default function ConnectView() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'agents' ? 'agents' : 'roommates';

  const select = (next: 'roommates' | 'agents') => {
    setParams(next === 'roommates' ? {} : { tab: 'agents' }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl bg-ink-700 p-1">
        {(['roommates', 'agents'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => select(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${
              tab === t ? 'text-brand-600 shadow-[inset_0_0_0_1px_#9184d9]' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'roommates' ? <RoommatesView /> : <AgentsView />}
    </div>
  );
}
