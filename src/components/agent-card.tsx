import { useState } from 'react';
import type { AgentProfile } from '../lib/social/types';

/**
 * A directory agent card. Photo (or initials fallback), verified badge, cities +
 * specialties, and a Contact action that reveals the email / opens a booking link
 * and records a lead. Agent data here is public (world-readable row), so unlike
 * roommate cards there's nothing to gate.
 */
export default function AgentCard({
  agent,
  onContact,
}: {
  agent: AgentProfile;
  onContact: (agent: AgentProfile) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const name = agent.displayName ?? 'Agent';

  const contact = () => {
    setRevealed(true);
    onContact(agent);
    if (agent.bookingUrl) window.open(agent.bookingUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col card p-5">
      <div className="flex items-start gap-4">
        {agent.photoUrl ? (
          <img
            src={agent.photoUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <Avatar name={name} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold text-slate-900">{name}</p>
            {agent.verified && (
              <span
                title="Verified agent"
                className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300"
              >
                ✓ Verified
              </span>
            )}
          </div>
          {agent.brokerage && <p className="mt-0.5 truncate text-xs text-slate-500">{agent.brokerage}</p>}
        </div>
      </div>

      {agent.bio && <p className="mt-3 text-sm text-slate-600">{agent.bio}</p>}

      {agent.cities.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">Serves {agent.cities.join(', ')}</p>
      )}

      {agent.specialties.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {agent.specialties.map((s) => (
            <span key={s} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        {revealed && agent.contactEmail ? (
          <a
            href={`mailto:${agent.contactEmail}`}
            className="btn-outline w-full rounded-xl px-4 py-2.5 text-sm"
          >
            {agent.contactEmail}
          </a>
        ) : (
          <button
            type="button"
            onClick={contact}
            className="btn-outline w-full rounded-xl px-4 py-2.5 text-sm"
          >
            {agent.bookingUrl ? 'Contact / Book' : 'Show contact'}
          </button>
        )}
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
      {initials || '?'}
    </div>
  );
}
