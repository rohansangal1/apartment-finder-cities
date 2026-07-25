import { useEffect, useState } from 'react';
import { useUserData } from '../context/user-data-context';
import type { SocialProfile } from '../lib/social/types';
import { EMPTY_SOCIAL_PROFILE } from '../lib/social/types';
import { Field, Switch } from './form-controls';

/**
 * Account card for roommate matching. The master toggle (roommate_opt_in) gates
 * ALL visibility — off by default. When on, we explain exactly what's shared
 * (derived signals: cities, budget band, bed count — never exact addresses or
 * private notes) and collect a light profile shown to potential matches.
 */
export default function RoommateOptInCard() {
  const { getSocialProfile, saveSocialProfile } = useUserData();
  const [profile, setProfile] = useState<SocialProfile>(EMPTY_SOCIAL_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    let cancelled = false;
    getSocialProfile()
      .then((p) => {
        if (!cancelled && p) setProfile(p);
      })
      .catch((e) => console.error('Failed to load social profile', e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [getSocialProfile]);

  const patch = (fields: Partial<SocialProfile>) => setProfile((p) => ({ ...p, ...fields }));

  const persist = async (next: SocialProfile) => {
    setSaveState('saving');
    try {
      await saveSocialProfile(next);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (e) {
      console.error(e);
      setSaveState('idle');
    }
  };

  const toggle = () => {
    const next = { ...profile, roommateOptIn: !profile.roommateOptIn };
    setProfile(next);
    void persist(next);
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg text-slate-900">Roommate matching</h3>
          <p className="mt-1 text-sm text-slate-500">
            Find people hunting for the same kind of place. Off until you turn it on.
          </p>
        </div>
        <Switch on={profile.roommateOptIn} onClick={toggle} disabled={loading} label="Roommate matching" />
      </div>

      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
        When on, other opted-in users can see your <strong>cities, budget band, and bedroom
        counts</strong> — never your exact saved addresses or private notes. Contact details are
        shared only after you <strong>both</strong> accept a connection.
      </p>

      {profile.roommateOptIn && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Display name">
              <input
                className="input"
                value={profile.displayName ?? ''}
                onChange={(e) => patch({ displayName: e.target.value })}
                placeholder="How matches see you"
              />
            </Field>
            <Field label="Age range">
              <input
                className="input"
                value={profile.ageRange ?? ''}
                onChange={(e) => patch({ ageRange: e.target.value })}
                placeholder="e.g. 25–29"
              />
            </Field>
            <Field label="Target move-in">
              <input
                className="input"
                value={profile.moveInMonth ?? ''}
                onChange={(e) => patch({ moveInMonth: e.target.value })}
                placeholder="e.g. September"
              />
            </Field>
            <Field label="Contact email (revealed on match)">
              <input
                className="input"
                type="email"
                value={profile.contactEmail ?? ''}
                onChange={(e) => patch({ contactEmail: e.target.value })}
                placeholder="Defaults to your account email"
              />
            </Field>
            <Field label="Budget min ($/mo)">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={profile.budgetMin ?? ''}
                onChange={(e) => patch({ budgetMin: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Field>
            <Field label="Budget max ($/mo)">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={profile.budgetMax ?? ''}
                onChange={(e) => patch({ budgetMax: e.target.value ? Number(e.target.value) : undefined })}
              />
            </Field>
          </div>
          <Field label="Short bio">
            <textarea
              className="input min-h-[72px] resize-y"
              value={profile.bio ?? ''}
              maxLength={500}
              onChange={(e) => patch({ bio: e.target.value })}
              placeholder="A sentence or two: your habits, what you're looking for in a roommate."
            />
          </Field>
          <button
            type="button"
            onClick={() => void persist(profile)}
            disabled={saveState === 'saving'}
            className="btn-outline w-full rounded-xl px-4 py-2.5 text-sm disabled:opacity-60"
          >
            {saveState === 'saved' ? '✓ Profile saved' : saveState === 'saving' ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      )}
    </div>
  );
}

