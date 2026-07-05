import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '../context/auth-context';
import { useUserData } from '../context/user-data-context';
import { useSearch } from '../context/search-context';
import AuthForm from '../components/auth-form';

/**
 * Account view. With Supabase configured, users can create an account with
 * email/password or continue with Google; signing in unlocks synced saved
 * listings, verified reviews, and saved default search preferences. Without
 * Supabase configured, the form explains that auth isn't wired yet (guest mode)
 * and the controls are disabled.
 */
export default function AccountView() {
  const { enabled, user, signOut } = useAuth();
  const { savePreferences } = useUserData();
  const { criteria } = useSearch();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const saveCurrentAsDefaults = async () => {
    setSaveState('saving');
    try {
      await savePreferences({
        homeCity: criteria.city,
        workAddress: criteria.workAddress,
        commuteMode: criteria.commuteMode,
        weights: criteria.weights,
        monthlyIncome: criteria.monthlyIncome,
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (e) {
      console.error(e);
      setSaveState('idle');
    }
  };

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to sync your shortlist and skip re-entering your situation each visit.
        </p>
      </header>

      {/* Signed-in state */}
      {enabled && user ? (
        <div className="rounded-2xl border border-slate-200 bg-ink p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{displayName(user)}</p>
              <p className="truncate text-sm text-slate-500">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={saveCurrentAsDefaults}
            disabled={saveState === 'saving'}
            className="mt-5 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saveState === 'saved'
              ? '✓ Saved as your defaults'
              : saveState === 'saving'
              ? 'Saving…'
              : 'Save current search as my defaults'}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">
            Pre-fills {criteria.city} · {criteria.commuteMode} and your priority weights next time.
          </p>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      ) : (
        /* Signed-out / guest state — self-service sign-up, sign-in, or Google. */
        <AuthForm />
      )}

      <div className="rounded-2xl border border-slate-200 bg-ink p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          What signing in unlocks
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {[
            'Saved apartments synced across all your devices',
            'Default work address, commute mode & priorities pre-filled',
            'Write verified reviews for places you’ve lived',
            'Your data stays yours — row-level security per account',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 text-brand-500">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Avatar({ user }: { user: { user_metadata?: { avatar_url?: string } } }) {
  const url = user.user_metadata?.avatar_url;
  if (url) {
    return <img src={url} alt="" className="h-12 w-12 rounded-full" referrerPolicy="no-referrer" />;
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    </div>
  );
}

/**
 * Best display name for a signed-in user: full_name (Google or email sign-up),
 * then first + last, then the email local-part, then a generic fallback.
 */
function displayName(user: User): string {
  const meta = user.user_metadata ?? {};
  const full = (meta.full_name as string | undefined)?.trim();
  if (full) return full;
  const composed = [meta.first_name, meta.last_name]
    .filter((p): p is string => Boolean(p && String(p).trim()))
    .join(' ')
    .trim();
  if (composed) return composed;
  if (user.email) return user.email.split('@')[0];
  return 'Signed in';
}
