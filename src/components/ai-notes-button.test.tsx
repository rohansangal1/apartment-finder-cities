import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AiNotesButton from './ai-notes-button';
import type { Listing } from '../lib/types';
import type { AiNotes } from '../lib/ai-notes';

// The button reads notes straight from UserDataContext; the panel is only
// mounted on click and pulls in the whole streaming stack, so it's stubbed out.
const userData = { aiNotes: {} as Record<string, AiNotes>, saveAiNotes: vi.fn() };
vi.mock('../context/user-data-context', () => ({ useUserData: () => userData }));
// Generating notes needs an account, so the button reads auth state too.
const auth = { enabled: true, user: { id: 'u1' } as { id: string } | null };
vi.mock('../context/auth-context', () => ({ useAuth: () => auth }));
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

/** The sign-in placeholder is a Link, so a router has to be in scope. */
const renderButton = (props: Parameters<typeof AiNotesButton>[0]) =>
  render(
    <MemoryRouter>
      <AiNotesButton {...props} />
    </MemoryRouter>
  );

describe('AiNotesButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userData.aiNotes = {};
    auth.enabled = true;
    auth.user = { id: 'u1' };
  });

  it('offers the trigger when the listing has no notes yet', () => {
    renderButton({ listing: listing() });
    expect(screen.getByRole('button', { name: /Generate notes/ })).toBeInTheDocument();
  });

  // The core rule: notes are generated once per listing, so once a set exists
  // the trigger is gone and what it produced stands in its place.
  it('replaces the trigger with the notes once they exist', () => {
    userData.aiNotes = { l1: notes };
    renderButton({ listing: listing() });

    expect(screen.queryByRole('button', { name: /Generate notes/ })).not.toBeInTheDocument();
    expect(screen.getByText(/is 300 m away/)).toBeInTheDocument();
  });

  it('credits the model and the lookups behind the notes', () => {
    userData.aiNotes = { l1: notes };
    renderButton({ listing: listing() });
    expect(screen.getByText(/gemma-4-31b-it · from Google Places/)).toBeInTheDocument();
  });

  it('keys notes by listing id, so another listing still shows the trigger', () => {
    userData.aiNotes = { l1: notes };
    renderButton({ listing: listing({ id: 'l2' }) });
    expect(screen.getByRole('button', { name: /Generate notes/ })).toBeInTheDocument();
  });

  it('renders bold runs as emphasis rather than literal asterisks', () => {
    userData.aiNotes = { l1: notes };
    renderButton({ listing: listing() });
    expect(screen.getByText('solid').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  // ---- Auth gate ----
  // Runs cost shared model quota, so the server requires a session. The UI has
  // to agree with it: a trigger that always 401s would be a broken promise.
  describe('when signed out', () => {
    beforeEach(() => {
      auth.user = null;
    });

    it('offers a route to sign in instead of the trigger', () => {
      renderButton({ listing: listing() });

      expect(screen.queryByRole('button', { name: /Generate notes/ })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Sign in for notes/ })).toHaveAttribute(
        'href',
        '/account'
      );
    });

    // Gating generation must not retract notes the user already has — they're
    // still readable from local storage in guest mode.
    it('still shows notes that already exist', () => {
      userData.aiNotes = { l1: notes };
      renderButton({ listing: listing() });

      expect(screen.getByText(/is 300 m away/)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Sign in for notes/ })).not.toBeInTheDocument();
    });

    // With no auth configured at all there is nothing to sign in to, so the
    // placeholder would send the user to a dead end.
    it('shows nothing at all when auth is not configured', () => {
      auth.enabled = false;
      const { container } = renderButton({ listing: listing() });
      expect(container).toBeEmptyDOMElement();
    });
  });
});
