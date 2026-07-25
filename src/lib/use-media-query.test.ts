import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from './use-media-query';

/** A controllable matchMedia stand-in, so tests can flip the query at will. */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  let matches = initial;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }))
  );
  return {
    set(next: boolean) {
      matches = next;
      for (const fn of listeners) fn();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('useMediaQuery', () => {
  it('reports the query state on first render', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(true);
  });

  it('re-renders when the query starts matching', () => {
    const mql = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);

    act(() => mql.set(true));
    expect(result.current).toBe(true);
  });

  it('unsubscribes on unmount so it cannot leak or set state after teardown', () => {
    const mql = stubMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(mql.listenerCount).toBe(1);
    unmount();
    expect(mql.listenerCount).toBe(0);
  });

  it('returns false rather than throwing where matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    // The hook guards on `'matchMedia' in window`, so delete the key entirely.
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    // @ts-expect-error — deliberately removing a DOM API to exercise the guard.
    delete window.matchMedia;
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
    if (original) Object.defineProperty(window, 'matchMedia', original);
  });
});
