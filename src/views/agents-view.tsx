import { useEffect, useState } from 'react';
import { useSearch } from '../context/search-context';
import type { AgentProfile } from '../lib/social/types';
import { listAgents, contactAgent } from '../lib/social/client';
import AgentCard from '../components/agent-card';

/**
 * Agents page. Lists self-listed real-estate agents serving a city (defaults to the
 * user's current search city, editable). Contacting an agent reveals their email /
 * opens their booking link and records a lead. Agent rows are public, so no opt-in
 * gating here.
 */
export default function AgentsView() {
  const { criteria } = useSearch();
  const [city, setCity] = useState(criteria.city ?? '');
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Debounce the city filter so typing doesn't fire a query per keystroke.
  const debouncedCity = useDebounced(city, 300);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAgents(debouncedCity.trim() || undefined)
      .then((a) => !cancelled && setAgents(a))
      .catch((e) => console.error('Failed to load agents', e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debouncedCity]);

  const onContact = (agent: AgentProfile) => {
    // Best-effort lead capture; the card reveals contact regardless of this result.
    void contactAgent(agent.userId, debouncedCity.trim() || undefined).catch((e) =>
      console.error('Failed to record lead', e)
    );
  };

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900">Agents</h1>
        <p className="mt-1 text-sm text-slate-500">
          Local agents who can help you find and land a place in your city.
        </p>
      </header>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">City</span>
        <input
          className="input max-w-sm"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Filter by city (e.g. Austin)"
        />
      </label>

      {loading ? (
        <p className="text-sm text-slate-500">Finding agents…</p>
      ) : agents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No agents listed{city.trim() ? ` in ${city.trim()}` : ''} yet. Check back soon — or list
          yourself from the Account page.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.userId} agent={a} onContact={onContact} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Return `value` after it has stopped changing for `delayMs`. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
