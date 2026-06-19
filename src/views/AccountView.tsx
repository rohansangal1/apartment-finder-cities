import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserData } from '../context/UserDataContext';
import { useSearch } from '../context/SearchContext';

/**
 * Account view. With Supabase configured, "Continue with Google" runs the real
 * OAuth flow; signing in unlocks synced saved listings, verified reviews, and
 * saved default search preferences. Without Supabase configured, it explains
 * that auth isn't wired yet (guest mode) and the button is disabled.
 */
export default function AccountView() {
  const { enabled, user, status, signInWithGoogle, signOut } = useAuth();
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">
                {user.user_metadata?.full_name || 'Signed in'}
              </p>
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
        /* Signed-out / guest state */
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-7 w-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-800">You're browsing as a guest</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {enabled
              ? 'Sign in with Google to sync your shortlist across devices and write verified reviews. Real identities make "lived here" reviews far harder to spam.'
              : 'Auth isn’t configured in this environment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Google sign-in; until then your shortlist is saved on this device.'}
          </p>

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={!enabled || status === 'loading'}
            title={enabled ? 'Sign in with Google' : 'Configure Supabase to enable'}
            className="mt-5 inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition enabled:hover:bg-slate-50 disabled:text-slate-400"
          >
            <GoogleGlyph />
            {enabled ? 'Continue with Google' : 'Continue with Google (not configured)'}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
