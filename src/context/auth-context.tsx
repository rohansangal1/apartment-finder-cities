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
}

interface AuthContextValue {
  enabled: boolean;
  user: User | null;
  status: AuthStatus;
  signInWithGoogle: () => Promise<void>;
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
      // With "Confirm email" on, signUp returns a user but no session until the
      // link is clicked. Detect that so the UI can show a "check your email" state
      // instead of assuming the user is signed in.
      return { needsEmailConfirmation: !data.session };
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
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextValue = {
    enabled: isSupabaseEnabled,
    user,
    status,
    signInWithGoogle,
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
