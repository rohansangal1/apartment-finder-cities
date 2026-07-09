import { useState } from 'react';
import type { RoommateCandidate } from '../lib/social/types';
import MatchScore from './match-score';

/**
 * A single roommate match card. Mirrors the listing-card language (avatar header +
 * MatchScore ring, tag row, "why matched", a primary action) so the Roommates page
 * feels of a piece with Results. Shows only anonymized/derived data — no email
 * until a connection is mutually accepted.
 */
export default function RoommateCard({
  candidate,
  onConnect,
}: {
  candidate: RoommateCandidate;
  onConnect: (userId: string) => Promise<void>;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const connect = async () => {
    setState('sending');
    try {
      await onConnect(candidate.userId);
      setState('sent');
    } catch (e) {
      console.error(e);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  const name = candidate.displayName ?? 'Someone nearby';
  const tags = [...candidate.sharedCities, ...candidate.sharedNeighborhoods];

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-ink p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {[candidate.ageRange, candidate.moveInMonth && `move-in ${candidate.moveInMonth}`]
              .filter(Boolean)
              .join(' · ') || 'Roommate seeker'}
          </p>
        </div>
        <MatchScore score={candidate.score} size="sm" />
      </div>

      {candidate.bio && <p className="mt-3 text-sm text-slate-600">{candidate.bio}</p>}

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {candidate.budgetBand && (
        <p className="mt-3 text-xs text-slate-500">
          Budget <span className="data text-slate-600">
            ${candidate.budgetBand[0].toLocaleString()}–${candidate.budgetBand[1].toLocaleString()}
          </span>/mo
        </p>
      )}

      <button
        type="button"
        onClick={connect}
        disabled={state === 'sending' || state === 'sent'}
        className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {state === 'sent'
          ? '✓ Request sent'
          : state === 'sending'
          ? 'Sending…'
          : state === 'error'
          ? 'Retry'
          : 'Connect'}
      </button>
    </div>
  );
}

/** Initials avatar — no photos in the anonymized match card. */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
      {initials || '?'}
    </div>
  );
}
