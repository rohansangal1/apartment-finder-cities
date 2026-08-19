import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/auth-context';

/**
 * "Sign in with Google" rendered by Google Identity Services, in-page.
 *
 * Why this exists rather than `signInWithOAuth`: that flow redirects the browser
 * to `<project>.supabase.co/auth/v1/callback`, and Google's account chooser names
 * whatever it is about to redirect to. Users saw "to continue to
 * ociwhtihuzatdwmxajwe.supabase.co" — an opaque host with no visible connection
 * to this site, which is exactly the shape of a phishing page and gives them no
 * way to tell the difference.
 *
 * GIS never leaves this origin. It hands us an ID token in the page, which goes
 * straight to `signInWithIdToken`, so the chooser shows this app's name from the
 * OAuth consent screen instead. No custom domain or paid add-on needed.
 *
 * Requires VITE_GOOGLE_CLIENT_ID, plus two dashboard settings:
 *   Google Cloud → Credentials → the OAuth client → Authorized JavaScript origins
 *     must list this site's origin (and http://localhost:5173 for dev).
 *   Supabase → Auth → Providers → Google → Authorized Client IDs must list the
 *     same client id, or the token is rejected.
 * Without the env var, AuthForm falls back to the redirect flow.
 */

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

/** Minimal surface of the GIS client we actually use. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        nonce?: string;
        use_fedcm_for_prompt?: boolean;
      }): void;
      renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
      disableAutoSelect(): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

/** Load the GIS script once per page, reusing the in-flight promise. */
let scriptPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Google binds the ID token to a nonce, and Supabase re-checks it. Google is
 * given the SHA-256 *hash*; Supabase is given the raw value and hashes it again
 * to compare. Sending the same string to both fails verification.
 */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { raw, hashed };
}

export default function GoogleSignInButton({ clientId }: { clientId: string }) {
  const { signInWithGoogleIdToken } = useAuth();
  const target = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [{ raw, hashed }] = await Promise.all([makeNonce(), loadGis()]);
        if (cancelled || !target.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashed,
          use_fedcm_for_prompt: true,
          callback: ({ credential }) => {
            signInWithGoogleIdToken(credential, raw).catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Google sign-in failed.');
            });
          },
        });
        window.google.accounts.id.renderButton(target.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 320,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load Google sign-in.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, signInWithGoogleIdToken]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={target} />
      {error && (
        <p role="alert" className="text-sm text-amber-600">
          {error}
        </p>
      )}
    </div>
  );
}
