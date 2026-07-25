import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ScoredListing, SearchCriteria } from '../lib/types';

const criteria: SearchCriteria = {
  city: 'San Francisco',
  inPerson: true,
  workAddress: '1 Market St',
  maxRent: 3500,
  bedrooms: 1,
  commuteMode: 'transit',
  weights: { commute: 1, price: 1, rating: 1, space: 1 },
};

const entry = (id: string, matchScore: number): ScoredListing => ({
  listing: {
    id,
    source: 'mock',
    listingUrl: 'https://example.com/' + id,
    address: `${id} Street`,
    neighborhood: `Neighborhood ${id}`,
    city: 'San Francisco',
    lat: 37.7,
    lng: -122.4,
    rentMonthly: 3000,
    bedrooms: 1,
    tags: [],
    ratingValue: 4,
    ratingSource: 'google',
  },
  matchScore,
  commuteMinutes: 15,
  commuteMode: 'transit',
  whyItMatched: 'A quick commute.',
  subScores: { commute: 80, price: 40, rating: 80, space: 100 },
  commuteApplies: true,
});

const searchState = {
  results: [] as ScoredListing[],
  status: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
  error: null as string | null,
  hasSearched: false,
  criteria,
};

vi.mock('../context/search-context', () => ({ useSearch: () => searchState }));
// These stubs mirror the real context values exactly — a stub that drifts from
// the interface it stands in for tests nothing but itself.
vi.mock('../context/user-data-context', () => ({
  useUserData: () => ({
    saveSearch: vi.fn(),
    savedListings: [],
    isSaved: () => false,
    toggleSaved: vi.fn(),
  }),
}));
vi.mock('../context/compare-context', () => ({
  useCompare: () => ({
    entries: [],
    isSelected: () => false,
    isFull: false,
    toggle: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  }),
  toScoredFallback: (l: unknown) => l,
}));
// Leaflet needs a real layout box and is lazy-loaded; the desktop split is the
// only thing that mounts it, and useMediaQuery is stubbed to mobile below.
vi.mock('../components/results-map', () => ({ default: () => <div>MAP</div> }));
vi.mock('../lib/use-media-query', () => ({ useMediaQuery: () => false }));
vi.mock('../lib/deal-score', () => ({ fetchDealScores: vi.fn(async () => null) }));

const ResultsView = (await import('./results-view')).default;

const renderResults = () =>
  render(
    <MemoryRouter>
      <ResultsView />
    </MemoryRouter>
  );

beforeEach(() => {
  searchState.results = [];
  searchState.status = 'idle';
  searchState.error = null;
  searchState.hasSearched = false;
});

describe('ResultsView', () => {
  it('invites a first search before anything has been run', () => {
    renderResults();
    expect(screen.getByRole('heading', { name: /No search yet/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start a search/ })).toBeInTheDocument();
  });

  it('surfaces the error message when a search fails', () => {
    searchState.hasSearched = true;
    searchState.status = 'error';
    searchState.error = 'RentCast is unreachable';
    renderResults();
    expect(screen.getByText('RentCast is unreachable')).toBeInTheDocument();
  });

  it('says which city came up empty rather than showing a bare zero', () => {
    searchState.hasSearched = true;
    searchState.status = 'ready';
    renderResults();
    expect(screen.getByRole('heading', { name: /No matches found/ })).toBeInTheDocument();
    expect(screen.getByText(/San Francisco/)).toBeInTheDocument();
  });

  it('counts the matches it found', () => {
    searchState.hasSearched = true;
    searchState.status = 'ready';
    searchState.results = [entry('a', 90), entry('b', 70), entry('c', 50)];
    renderResults();
    expect(screen.getByRole('heading', { name: /3 matches in San Francisco/ })).toBeInTheDocument();
  });

  it('lists the results best-first', () => {
    searchState.hasSearched = true;
    searchState.status = 'ready';
    searchState.results = [entry('a', 90), entry('b', 70), entry('c', 50)];
    renderResults();
    const shown = screen.getAllByText(/^Neighborhood /).map((el) => el.textContent);
    expect(shown).toEqual(['Neighborhood a', 'Neighborhood b', 'Neighborhood c']);
  });

  it('offers the scoring explainer from the results header', () => {
    searchState.hasSearched = true;
    searchState.status = 'ready';
    searchState.results = [entry('a', 90)];
    renderResults();
    expect(screen.getByRole('link', { name: /how\?/i })).toHaveAttribute('href', '/how-it-works');
  });

  it('does not promise a commute ranking for a remote search', () => {
    searchState.hasSearched = true;
    searchState.status = 'ready';
    searchState.results = [entry('a', 90)];
    searchState.criteria = { ...criteria, inPerson: false };
    renderResults();
    expect(screen.getByText(/Ranked by your priorities/)).toBeInTheDocument();
    expect(screen.queryByText(/\+ commute/)).not.toBeInTheDocument();
    searchState.criteria = criteria;
  });
});
