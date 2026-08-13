import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AiNotesButton from './ai-notes-button';
import type { Listing } from '../lib/types';
import type { AiNotes } from '../lib/ai-notes';

// The button reads notes straight from UserDataContext; the panel is only
// mounted on click and pulls in the whole streaming stack, so it's stubbed out.
const userData = { aiNotes: {} as Record<string, AiNotes>, saveAiNotes: vi.fn() };
vi.mock('../context/user-data-context', () => ({ useUserData: () => userData }));
vi.mock('./ai-notes-panel', () => ({ default: () => <div>panel</div> }));

const listing = (over: Partial<Listing> = {}): Listing => ({
  id: 'l1',
  source: 'rentcast',
  listingUrl: 'https://example.com/l1',
  address: '123 Main St',
  neighborhood: 'Bushwick',
  city: 'Brooklyn',
  lat: 40.7,
  lng: -73.9,
  rentMonthly: 2400,
  bedrooms: 1,
  tags: ['Apartment'],
  ratingValue: null,
  ratingSource: 'google',
  ...over,
});

const notes: AiNotes = {
  text: 'A **solid** block.\n- Trader Joe’s is 300 m away',
  sources: ['Google Places'],
  model: 'gemma-4-31b-it',
  generatedAt: '2026-08-13T00:00:00.000Z',
};

describe('AiNotesButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userData.aiNotes = {};
  });

  it('offers the trigger when the listing has no notes yet', () => {
    render(<AiNotesButton listing={listing()} />);
    expect(screen.getByRole('button', { name: /Generate notes/ })).toBeInTheDocument();
  });

  // The core rule: notes are generated once per listing, so once a set exists
  // the trigger is gone and what it produced stands in its place.
  it('replaces the trigger with the notes once they exist', () => {
    userData.aiNotes = { l1: notes };
    render(<AiNotesButton listing={listing()} />);

    expect(screen.queryByRole('button', { name: /Generate notes/ })).not.toBeInTheDocument();
    expect(screen.getByText(/is 300 m away/)).toBeInTheDocument();
  });

  it('credits the model and the lookups behind the notes', () => {
    userData.aiNotes = { l1: notes };
    render(<AiNotesButton listing={listing()} />);
    expect(screen.getByText(/gemma-4-31b-it · from Google Places/)).toBeInTheDocument();
  });

  it('keys notes by listing id, so another listing still shows the trigger', () => {
    userData.aiNotes = { l1: notes };
    render(<AiNotesButton listing={listing({ id: 'l2' })} />);
    expect(screen.getByRole('button', { name: /Generate notes/ })).toBeInTheDocument();
  });

  it('renders bold runs as emphasis rather than literal asterisks', () => {
    userData.aiNotes = { l1: notes };
    render(<AiNotesButton listing={listing()} />);
    expect(screen.getByText('solid').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });
});
