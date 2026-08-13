import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/auth-context';
import GoogleSignInButton from './google-signin-button';

const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';

/**
 * Self-service auth panel: create an account with first/last/email/password or
 * sign in, plus Google OAuth below a divider. Both paths coexist. On sign-up
 * with email confirmation on, we show a "check your email" state (no session yet).
 */
type Mode = 'signin' | 'signup';

export default function AuthForm() {
  const {
    enabled,
    status,
    signInWithGoogle,
    signUpWithPassword,
    signInWithPassword,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const disabled = !enabled || status === 'loading' || busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { needsEmailConfirmation, alreadyRegistered } = await signUpWithPassword({
          firstName,
          lastName,
          email,
          password,
        });
        if (alreadyRegistered) {
          setMode('signin');
          setPassword('');
          setNotice(
            'An account with this email already exists. Try signing in, or reset your password.'
          );
        } else if (needsEmailConfirmation) {
          setNotice(`Check your email — we sent a confirmation link to ${email.trim()}.`);
          setPassword('');
        }
        // If confirmation is off, onAuthStateChange signs them in automatically.
      } else {
        await signInWithPassword(email, password);
        // Success flips the whole view via auth state; nothing else to do here.
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError('Enter your email above first, then tap “Forgot password?”.');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setNotice(`Password reset link sent to ${email.trim()}.`);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  // Shared dark-theme input styling (defined in index.css). Adding disabled dimming.
  const inputClass = 'input disabled:opacity-60';

  return (
    <div className="card p-6">
      {/* Mode toggle — matches the app's segmented control (results view). */}
      <div className="mx-auto mb-5 flex max-w-xs overflow-hidden rounded-lg border border-slate-200 text-sm font-semibold">
        {(['signin', 'signup'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
              setNotice(null);
            }}
            className={`flex-1 px-3 py-2 transition ${
              mode === m
                ? 'text-brand-600 shadow-[inset_0_0_0_1px_#9184d9]'
                : 'bg-ink text-slate-600 hover:text-slate-900'
            }`}
          >
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      {!enabled && (
        <p className="mb-4 rounded-lg bg-amber-500/15 px-3 py-2 text-center text-xs text-amber-300">
          Auth isn’t configured in this environment. Add VITE_SUPABASE_URL and
          VITE_SUPABASE_ANON_KEY to enable accounts.
        </p>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && (
          <div className="flex gap-3">
            <input
              className={inputClass}
              type="text"
              autoComplete="given-name"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              disabled={disabled}
            />
            <input
              className={inputClass}
              type="text"
              autoComplete="family-name"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              disabled={disabled}
            />
          </div>
        )}

        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={disabled}
        />

        <input
          className={inputClass}
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'signup' ? 8 : undefined}
          disabled={disabled}
        />
        {mode === 'signup' && (
          <p className="text-xs text-slate-400">At least 8 characters.</p>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-600">{notice}</p>}

        <button
          type="submit"
          disabled={disabled}
          className="btn-outline w-full rounded-xl px-4 py-2.5 text-sm disabled:opacity-60"
        >
          {busy
            ? 'Working…'
            : mode === 'signup'
            ? 'Create account'
            : 'Sign in'}
        </button>

        {mode === 'signin' && (
          <button
            type="button"
            onClick={() => void forgot()}
            disabled={disabled}
            className="w-full text-center text-xs font-medium text-slate-500 transition hover:text-slate-700 disabled:opacity-60"
          >
            Forgot password?
          </button>
        )}
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3 text-xs font-medium text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Google Identity Services when a client id is configured: it keeps the
          whole flow on this origin, so Google's account chooser names this app
          instead of the Supabase project host. Without the env var we fall back
          to the redirect flow, which still works. */}
      {enabled && GOOGLE_CLIENT_ID ? (
        <GoogleSignInButton clientId={GOOGLE_CLIENT_ID} />
      ) : (
        <button
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={disabled}
          title={enabled ? 'Sign in with Google' : 'Configure Supabase to enable'}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-ink px-4 py-3 text-sm font-semibold text-slate-700 transition enabled:hover:bg-slate-50 disabled:text-slate-400"
        >
          <GoogleGlyph />
          Continue with Google
        </button>
      )}
    </div>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
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
