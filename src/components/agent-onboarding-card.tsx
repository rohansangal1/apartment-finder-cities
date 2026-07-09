import { useEffect, useState } from 'react';
import type { AgentProfile } from '../lib/social/types';
import { EMPTY_AGENT_PROFILE } from '../lib/social/types';
import { getMyAgentProfile, saveAgentProfile } from '../lib/social/client';
import { Field, Switch } from './form-controls';

/**
 * Account card for real-estate agents to self-list in the directory. Flipping
 * "I'm an agent" reveals the profile form; once saved with is_agent = true, the
 * row is world-readable and appears to searchers in the matching agent's cities.
 */
export default function AgentOnboardingCard() {
  const [profile, setProfile] = useState<AgentProfile>(EMPTY_AGENT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    getMyAgentProfile()
      .then((p) => {
        if (!cancelled && p) setProfile(p);
      })
      .catch((e) => console.error('Failed to load agent profile', e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = (fields: Partial<AgentProfile>) => setProfile((p) => ({ ...p, ...fields }));

  const persist = async (next: AgentProfile) => {
    setSaveState('saving');
    try {
      await saveAgentProfile(next);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (e) {
      console.error(e);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const toggle = () => {
    const next = { ...profile, isAgent: !profile.isAgent };
    setProfile(next);
    void persist(next);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-ink p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-semibold text-slate-900">I'm an agent</h3>
          <p className="mt-1 text-sm text-slate-500">
            List yourself so renters in your cities can find and contact you.
          </p>
        </div>
        <Switch on={profile.isAgent} onClick={toggle} disabled={loading} label="List as agent" />
      </div>

      {profile.isAgent && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input
                className="input"
                value={profile.displayName ?? ''}
                onChange={(e) => patch({ displayName: e.target.value })}
              />
            </Field>
            <Field label="Brokerage">
              <input
                className="input"
                value={profile.brokerage ?? ''}
                onChange={(e) => patch({ brokerage: e.target.value })}
              />
            </Field>
            <Field label="License #">
              <input
                className="input"
                value={profile.licenseNo ?? ''}
                onChange={(e) => patch({ licenseNo: e.target.value })}
              />
            </Field>
            <Field label="Contact email">
              <input
                className="input"
                type="email"
                value={profile.contactEmail ?? ''}
                onChange={(e) => patch({ contactEmail: e.target.value })}
                placeholder="Defaults to your account email"
              />
            </Field>
            <Field label="Cities served (comma-separated)">
              <input
                className="input"
                value={profile.cities.join(', ')}
                onChange={(e) => patch({ cities: splitList(e.target.value) })}
                placeholder="Austin, Round Rock"
              />
            </Field>
            <Field label="Specialties (comma-separated)">
              <input
                className="input"
                value={profile.specialties.join(', ')}
                onChange={(e) => patch({ specialties: splitList(e.target.value) })}
                placeholder="Rentals, Relocation"
              />
            </Field>
            <Field label="Photo URL">
              <input
                className="input"
                value={profile.photoUrl ?? ''}
                onChange={(e) => patch({ photoUrl: e.target.value })}
                placeholder="https://…"
              />
            </Field>
            <Field label="Booking link">
              <input
                className="input"
                value={profile.bookingUrl ?? ''}
                onChange={(e) => patch({ bookingUrl: e.target.value })}
                placeholder="https://cal.com/…"
              />
            </Field>
          </div>
          <Field label="Bio">
            <textarea
              className="input min-h-[72px] resize-y"
              value={profile.bio ?? ''}
              maxLength={600}
              onChange={(e) => patch({ bio: e.target.value })}
              placeholder="How you help renters, your experience, your style."
            />
          </Field>
          <button
            type="button"
            onClick={() => void persist(profile)}
            disabled={saveState === 'saving'}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saveState === 'saved'
              ? '✓ Listing published'
              : saveState === 'error'
              ? 'Something went wrong — retry'
              : saveState === 'saving'
              ? 'Saving…'
              : 'Publish listing'}
          </button>
        </div>
      )}
    </div>
  );
}

/** "Austin, Round Rock" → ["Austin", "Round Rock"] (trimmed, no empties). */
function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
