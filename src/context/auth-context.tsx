/**
 * Auth state (Phase 2). Wraps Supabase Auth — Google OAuth plus self-service
 * email/password sign-up. No custom auth server; the Supabase JS SDK handles
 * everything client-side (Google is configured in the dashboard, email/password
 * uses the same client). Exposes the current user, the sign-in/up/out methods,
 * and an `enabled` flag.
 *
 * When Supabase isn't configured (`isSupabaseEnabled === false`), this provides
 * a disabled, signed-out state so the rest of the app runs in guest mode without
 * branching everywhere.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseEnabled } from '../lib/supabase';

type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export interface SignUpParams {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/** Result of an email/password sign-up: whether a confirmation email was sent. */
export interface SignUpResult {
  /** True when Supabase requires email confirmation before a session is created. */
  needsEmailConfirmation: boolean;
  /**
   * True when the email is (very likely) already registered. Supabase obfuscates
   * this for anti-enumeration — on a duplicate sign-up it returns a success with
   * an empty `identities` array and no session — so we surface a gentle,
   * non-committal hint rather than a hard "email taken" error.
   */
  alreadyRegistered: boolean;
}

interface AuthContextValue {
  enabled: boolean;
  user: User | null;
  status: AuthStatus;
  signInWithGoogle: () => Promise<void>;
  /** Exchange a Google Identity Services credential for a Supabase session.
   * Preferred over signInWithGoogle — see google-signin-button.tsx. */
  signInWithGoogleIdToken: (credential: string, nonce: string) => Promise<void>;
  signUpWithPassword: (params: SignUpParams) => Promise<SignUpResult>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(isSupabaseEnabled ? 'loading' : 'signed-out');

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setStatus(data.session?.user ? 'signed-in' : 'signed-out');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session?.user ? 'signed-in' : 'signed-out');
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  /**
   * The in-page Google path: the browser already holds a Google ID token, so we
   * trade it for a Supabase session without ever redirecting to supabase.co —
   * which is what kept Google's account chooser naming the Supabase host rather
   * than this app. `nonce` is the raw value whose hash was given to Google;
   * Supabase re-hashes it to verify the token was minted for this request.
   */
  const signInWithGoogleIdToken = useCallback(async (credential: string, nonce: string) => {
    if (!supabase) throw new Error('Auth is not configured.');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credential,
      nonce,
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Auth is not configured.');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Return to the exact page they signed in from (Supabase strips the OAuth
        // params on the way back via detectSessionInUrl).
        redirectTo: window.location.href,
        // Force Google's account chooser every time. Without this, Google
        // silently reuses the last session, so after signing out "Continue with
        // Google" drops you straight back into the same account.
        queryParams: { prompt: 'select_account' },
      },
    });
  }, []);

  const signUpWithPassword = useCallback(
    async ({ firstName, lastName, email, password }: SignUpParams): Promise<SignUpResult> => {
      if (!supabase) throw new Error('Auth is not configured.');
      // Defense-in-depth: enforce a minimum password length in code too, not just
      // via the input's minLength (also set a minimum in the Supabase dashboard).
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      const first = firstName.trim();
      const last = lastName.trim();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Stored on auth.users.user_metadata; the account view reads these and
          // the profile upsert mirrors them into public.users.
          data: {
            first_name: first,
            last_name: last,
            full_name: `${first} ${last}`.trim(),
          },
          emailRedirectTo: `${window.location.origin}/account`,
        },
      });
      if (error) throw error;
      // Anti-enumeration: a sign-up for an already-registered email comes back as
      // a success with no session and an empty `identities` array. Treat that as
      // "already registered" so we don't mislead them with a "check your email".
      const identities = data.user?.identities;
      const alreadyRegistered =
        !data.session && Array.isArray(identities) && identities.length === 0;
      // With "Confirm email" on, a genuine new sign-up returns a user but no
      // session until the link is clicked — show a "check your email" state then.
      return {
        needsEmailConfirmation: !data.session && !alreadyRegistered,
        alreadyRegistered,
      };
    },
    []
  );

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Auth is not configured.');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Auth is not configured.');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/account`,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // GIS remembers the last account and will auto-select it on the next visit,
    // which is the same "drops you straight back into the same account" problem
    // that prompt=select_account solves for the redirect flow.
    window.google?.accounts.id.disableAutoSelect();
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = {
    enabled: isSupabaseEnabled,
    user,
    status,
    signInWithGoogle,
    signInWithGoogleIdToken,
    signUpWithPassword,
    signInWithPassword,
    resetPassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
