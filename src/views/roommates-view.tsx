import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { useUserData } from '../context/user-data-context';
import type { RoommateCandidate, RoommateConnection } from '../lib/social/types';
import {
  matchRoommates,
  listConnections,
  requestConnect,
  respondConnect,
} from '../lib/social/client';
import RoommateCard from '../components/roommate-card';

/**
 * Roommates page. Three states:
 *   - signed-in but opted out → explainer + CTA to enable in Account (privacy-first).
 *   - opted in / demo         → grid of anonymized candidate matches + a Requests panel.
 * All matching is server-computed over derived signals; contact is revealed only on
 * mutual accept (handled in the Requests panel).
 */
export default function RoommatesView() {
  const { enabled, user } = useAuth();
  const { getSocialProfile } = useUserData();
  const isRealUser = enabled && Boolean(user);

  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [candidates, setCandidates] = useState<RoommateCandidate[]>([]);
  const [connections, setConnections] = useState<RoommateConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshConnections = useCallback(async () => {
    try {
      setConnections(await listConnections());
    } catch (e) {
      console.error('Failed to load connections', e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getSocialProfile();
        const isOptedIn = profile?.roommateOptIn ?? false;
        if (cancelled) return;
        setOptedIn(isOptedIn);
        // Only fetch matches when opted in, or in demo mode (no real account).
        if (!isRealUser || isOptedIn) {
          const [cands] = await Promise.all([matchRoommates(), refreshConnections()]);
          if (!cancelled) setCandidates(cands);
        }
      } catch (e) {
        console.error('Failed to load roommate matches', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getSocialProfile, isRealUser, refreshConnections]);

  const onConnect = useCallback(
    async (userId: string) => {
      await requestConnect(userId);
      await refreshConnections();
    },
    [refreshConnections]
  );

  const onRespond = useCallback(
    async (connectionId: string, accept: boolean) => {
      await respondConnect(connectionId, accept);
      await refreshConnections();
    },
    [refreshConnections]
  );

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900">Roommates</h1>
        <p className="mt-1 text-sm text-slate-500">
          People searching for the same kind of place. Matched on your cities, budget, and space —
          never your exact saved addresses.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-500">Finding people near your search…</p>
      ) : isRealUser && optedIn === false ? (
        <OptInPrompt />
      ) : (
        <>
          <ConnectionsPanel connections={connections} onRespond={onRespond} />

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Suggested matches
            </h2>
            {candidates.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No matches yet. Save a few apartments so we can find people looking in the same
                places.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {candidates.map((c) => (
                  <RoommateCard key={c.userId} candidate={c} onConnect={onConnect} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function OptInPrompt() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-ink p-6 text-center shadow-sm">
      <h2 className="font-serif text-lg font-semibold text-slate-900">Roommate matching is off</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Turn it on to discover others hunting nearby. You control what's shared, and your exact
        saved addresses and notes stay private.
      </p>
      <Link
        to="/account"
        className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Enable in Account
      </Link>
    </div>
  );
}

function ConnectionsPanel({
  connections,
  onRespond,
}: {
  connections: RoommateConnection[];
  onRespond: (id: string, accept: boolean) => Promise<void>;
}) {
  const incoming = connections.filter((c) => c.direction === 'incoming' && c.status === 'pending');
  const accepted = connections.filter((c) => c.status === 'accepted');
  const outgoing = connections.filter((c) => c.direction === 'outgoing' && c.status === 'pending');

  if (!connections.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Requests</h2>
      <div className="space-y-2">
        {incoming.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-ink px-4 py-3 shadow-sm"
          >
            <p className="text-sm text-slate-700">
              <strong>{c.displayName ?? 'Someone'}</strong> wants to connect
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void onRespond(c.id, true)}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => void onRespond(c.id, false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
        {accepted.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-3"
          >
            <p className="text-sm text-slate-700">
              Connected with <strong>{c.displayName ?? 'your match'}</strong>
            </p>
            {c.contactEmail && (
              <a
                href={`mailto:${c.contactEmail}`}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                {c.contactEmail}
              </a>
            )}
          </div>
        ))}
        {outgoing.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-ink px-4 py-3 text-sm text-slate-500 shadow-sm"
          >
            <span>Request to {c.displayName ?? 'a match'}</span>
            <span className="text-xs font-medium text-slate-400">Pending</span>
          </div>
        ))}
      </div>
    </section>
  );
}
