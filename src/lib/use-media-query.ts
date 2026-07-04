import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and re-render when it changes. Used to switch
 * the Results view between the mobile list/map toggle and the desktop split view
 * without duplicating that decision in Tailwind breakpoints and JS.
 *
 * SSR-safe (returns false when matchMedia is unavailable) — though this app is a
 * client SPA, the guard keeps it robust and testable.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
