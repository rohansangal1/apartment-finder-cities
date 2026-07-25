import { describe, it, expect } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HowItWorksView from './how-it-works-view';
import { scoreListing, computeSubScores, MAX_COMMUTE } from '../lib/scoring';
import type { Listing, SearchCriteria } from '../lib/types';

// The page's contract is that it explains the *real* engine — so this test
// recomputes the worked example independently and asserts the page agrees. If
// anyone retunes lib/scoring.ts without revisiting the page, this fails.
const EXAMPLE_CRITERIA: SearchCriteria = {
  city: 'San Francisco',
  inPerson: true,
  workAddress: '1 Market St',
  maxRent: 3500,
  bedrooms: 1,
  commuteMode: 'transit',
  weights: { commute: 0.7, price: 0.7, rating: 0.5, space: 0.4 },
};

const EXAMPLE_LISTING: Listing = {
  id: 'example',
  source: 'mock',
  listingUrl: '#',
  address: '1200 Fillmore St, Unit 4',
  neighborhood: 'Lower Haight',
  city: 'San Francisco',
  lat: 37.78,
  lng: -122.43,
  rentMonthly: 3100,
  bedrooms: 1,
  tags: [],
  ratingValue: 4.2,
  ratingSource: 'google',
};

const EXAMPLE_COMMUTE = 18;

const renderPage = () =>
  render(
    <MemoryRouter>
      <HowItWorksView />
    </MemoryRouter>
  );

describe('How It Works', () => {
  it('shows the worked example score the real engine computes', () => {
    const expected = scoreListing(EXAMPLE_LISTING, EXAMPLE_CRITERIA, EXAMPLE_COMMUTE);
    renderPage();
    expect(screen.getAllByText(String(expected)).length).toBeGreaterThan(0);
  });

  it('shows each sub-score the real engine computes', () => {
    const sub = computeSubScores(EXAMPLE_LISTING, EXAMPLE_CRITERIA, EXAMPLE_COMMUTE);
    renderPage();
    const maths = screen.getByText('The maths').parentElement!;
    for (const value of Object.values(sub)) {
      expect(within(maths).getByText(new RegExp(`^${Math.round(value)}\\s*×`))).toBeInTheDocument();
    }
  });

  it('states the commute ceiling the engine actually uses', () => {
    renderPage();
    expect(screen.getByText(new RegExp(`0 at ${MAX_COMMUTE} minutes`))).toBeInTheDocument();
  });

  it('names all four dimensions', () => {
    renderPage();
    for (const label of ['Commute', 'Price', 'Rating', 'Space']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  describe('the weight playground', () => {
    it('re-scores through the real engine when a weight changes', async () => {
      renderPage();

      const before = scoreListing(EXAMPLE_LISTING, EXAMPLE_CRITERIA, EXAMPLE_COMMUTE);
      const after = scoreListing(
        { ...EXAMPLE_LISTING },
        { ...EXAMPLE_CRITERIA, weights: { ...EXAMPLE_CRITERIA.weights, price: 0 } },
        EXAMPLE_COMMUTE
      );
      expect(before).not.toBe(after); // otherwise the assertion below proves nothing

      // A range input can't be driven by typing. fireEvent.change goes through
      // React's value tracker, which a raw dispatchEvent does not.
      fireEvent.change(screen.getByLabelText('Price weight'), { target: { value: '0' } });

      expect(await screen.findByText(String(after))).toBeInTheDocument();
    });

    it('offers a slider for every dimension', () => {
      renderPage();
      for (const label of ['Commute weight', 'Price weight', 'Rating weight', 'Space weight']) {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      }
    });
  });
});
