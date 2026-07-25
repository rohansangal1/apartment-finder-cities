import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchDealScores } from './deal-score';
import type { Listing } from './types';

const listing = (id: string): Listing => ({
  id,
  source: 'mock',
  listingUrl: '',
  address: `${id} St`,
  neighborhood: 'Chelsea',
  city: 'New York',
  lat: 0,
  lng: 0,
  rentMonthly: 3000,
  bedrooms: 1,
  tags: [],
  ratingValue: 4,
  ratingSource: 'google',
});

const stubFetch = (impl: () => Promise<unknown>) =>
  vi.stubGlobal('fetch', vi.fn(impl as unknown as typeof fetch));

afterEach(() => vi.unstubAllGlobals());

describe('fetchDealScores', () => {
  it('returns the scores map on success', async () => {
    const scores = { a: { pctVsMedian: -12, percentile: 20, label: '12% below', scope: 'neighborhood', groupSize: 9 } };
    stubFetch(async () => ({ ok: true, json: async () => ({ scores }) }));
    await expect(fetchDealScores([listing('a')])).resolves.toEqual(scores);
  });

  it('does not call the network for an empty list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchDealScores([])).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // This feature is progressive enhancement: on plain `vite dev` the Python
  // endpoint isn't running at all. Every failure mode must degrade to `null` so
  // the caller renders no badge — never an error, never a rejected promise.
  it('degrades to null on a non-200 response', async () => {
    stubFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    await expect(fetchDealScores([listing('a')])).resolves.toBeNull();
  });

  it('degrades to null when the network throws', async () => {
    stubFetch(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(fetchDealScores([listing('a')])).resolves.toBeNull();
  });

  it('degrades to null on unparseable JSON', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    }));
    await expect(fetchDealScores([listing('a')])).resolves.toBeNull();
  });

  it('degrades to null when the payload has no scores key', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({}) }));
    await expect(fetchDealScores([listing('a')])).resolves.toBeNull();
  });

  it('sends only the fields the endpoint needs', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ scores: {} }) }));
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    await fetchDealScores([listing('a')]);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(Object.keys(sent.listings[0]).sort()).toEqual(
      ['bedrooms', 'city', 'id', 'neighborhood', 'rentMonthly'].sort()
    );
  });
});
