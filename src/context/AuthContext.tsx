/**
 * Auth state (Phase 2). Wraps Supabase Auth's Google provider — no custom auth
 * code, just configuration in the Supabase dashboard. Exposes the current user,
 * a sign-in/out pair, and an `enabled` flag.
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

interface AuthContextValue {
  enabled: boolean;
  user: User | null;
  status: AuthStatus;
  signInWithGoogle: () => Promise<void>;
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
      options: { redirectTo: window.location.origin },
    });
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
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
