/**
 * dataClient — the SINGLE boundary between the UI and all external data.
 *
 * The UI must NEVER import a mock file or call an external source directly. It
 * only ever imports from here. Switching from mock data to real APIs is a CONFIG
 * change, not a rewrite:
 *
 *   VITE_DATA_SOURCE=mock  -> mockClient (in-browser fixtures)
 *   VITE_DATA_SOURCE=api   -> apiClient  (calls /api serverless functions that
 *                            hold the secret keys + caching)
 *
 * Both implementations satisfy the same DataClient interface, so nothing in
 * /views or /components changes between phases.
 */
import type { DataClient, SearchCriteria, ScoredListing } from '../types';
import { mockClient } from './mockClient';
import { apiClient, search as apiSearch } from './apiClient';

const SOURCE: string = import.meta.env?.VITE_DATA_SOURCE || 'mock';

function resolveClient(): DataClient {
  switch (SOURCE) {
    case 'mock':
      return mockClient;
    case 'api':
      return apiClient;
    default:
      throw new Error(`Unknown VITE_DATA_SOURCE: "${SOURCE}"`);
  }
}

const client = resolveClient();

export const getListings: DataClient['getListings'] = (...args) => client.getListings(...args);
export const getCommute: DataClient['getCommute'] = (...args) => client.getCommute(...args);
export const getRating: DataClient['getRating'] = (...args) => client.getRating(...args);
export const geocode: DataClient['geocode'] = (...args) => client.geocode(...args);
export const getReviews: DataClient['getReviews'] = (...args) => client.getReviews(...args);

/**
 * One-shot server search. Defined only for the 'api' source, where the entire
 * orchestration (listings → commute → ratings → score → rank) runs in a single
 * round-trip behind POST /api/search. searchService prefers this when present to
 * avoid re-fetching per method. `null` on mock, where composing locally is free.
 */
export const serverSearch: ((criteria: SearchCriteria) => Promise<ScoredListing[]>) | null =
  SOURCE === 'api' ? apiSearch : null;

/** Active source name, surfaced in the UI footer so it's obvious we're on mock data. */
export const DATA_SOURCE = SOURCE;
