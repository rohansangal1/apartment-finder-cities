import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreBreakdown from './score-breakdown';
import type { SubScores } from '../lib/types';

const sub = (over: Partial<SubScores> = {}): SubScores => ({
  commute: 70,
  price: 40,
  rating: 85,
  space: 100,
  ...over,
});

describe('ScoreBreakdown', () => {
  it('labels all four dimensions', () => {
    render(<ScoreBreakdown subScores={sub()} />);
    for (const label of ['Commute', 'Price', 'Rating', 'Space']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('rounds each sub-score for display', () => {
    render(<ScoreBreakdown subScores={sub({ price: 40.6, rating: 84.4 })} />);
    expect(screen.getByText('41')).toBeInTheDocument();
    expect(screen.getByText('84')).toBeInTheDocument();
  });

  // computeSubScores fills commute with a neutral 100 for remote searches. Showing
  // that as a full bar would claim a perfect commute the user never has.
  it('shows commute as N/A for a remote search rather than a full bar', () => {
    render(<ScoreBreakdown subScores={sub({ commute: 100 })} commuteApplies={false} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.queryByText('100')).toBeInTheDocument(); // space is still 100
  });

  it('shows a commute number when the search has a commute', () => {
    render(<ScoreBreakdown subScores={sub({ commute: 70 })} commuteApplies />);
    expect(screen.queryByText('N/A')).not.toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
  });

  it('never renders a bar wider than the track', () => {
    const { container } = render(<ScoreBreakdown subScores={sub({ space: 100 })} />);
    for (const bar of container.querySelectorAll<HTMLElement>('[style*="width"]')) {
      const pct = Number.parseFloat(bar.style.width);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });

  it('grades bars down one accent family, never into another hue', () => {
    const { container } = render(
      <ScoreBreakdown subScores={{ commute: 90, price: 70, rating: 50, space: 10 }} />
    );
    const classes = [...container.querySelectorAll<HTMLElement>('[style*="width"]')].map(
      (el) => el.className
    );
    expect(classes[0]).toContain('bg-brand-700');
    expect(classes[1]).toContain('bg-brand-600');
    expect(classes[2]).toContain('bg-brand-300');
    expect(classes[3]).toContain('bg-slate-300');
    for (const c of classes) expect(c).not.toMatch(/emerald|amber|rose|green/);
  });
});
