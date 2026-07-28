import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import InputView from './input-view';

// The wizard only needs the two contexts it reads from; stubbing them keeps this
// a test of the wizard's own behaviour rather than of the data layer.
const search = vi.fn();
vi.mock('../context/search-context', async () => {
  const actual = await vi.importActual<typeof import('../context/search-context')>(
    '../context/search-context'
  );
  return {
    ...actual,
    useSearch: () => ({ criteria: actual.DEFAULT_CRITERIA, search }),
  };
});

vi.mock('../context/user-data-context', () => ({
  useUserData: () => ({
    getPreferences: async () => null,
    savedAddresses: [],
    saveAddress: vi.fn(),
    savedSearches: [],
    deleteSearch: vi.fn(),
  }),
}));

// The carousel pulls in mock listing imagery and is irrelevant to the wizard.
vi.mock('../components/apartment-carousel', () => ({ default: () => null }));

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<InputView />} />
        <Route path="/results" element={<div>RESULTS PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const advance = async (user: ReturnType<typeof userEvent.setup>, times: number) => {
  for (let i = 0; i < times; i++) {
    await user.click(screen.getByRole('button', { name: /Continue/ }));
  }
};

beforeEach(() => vi.clearAllMocks());

describe('search wizard', () => {
  it('starts on step 1', () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: /Where are you looking/ })).toBeInTheDocument();
  });

  // Every other route into the scoring explainer sits on a page you only reach
  // after searching, so this hero link is the only one a first-time visitor
  // meets. Pinned so it can't quietly disappear in a future hero edit.
  it('offers the scoring explainer from the hero', () => {
    renderWizard();
    expect(screen.getByRole('link', { name: /See how it ranks/ })).toHaveAttribute(
      'href',
      '/how-it-works'
    );
  });

  it('walks forward through all four steps', async () => {
    const user = userEvent.setup();
    renderWizard();

    expect(screen.getByRole('heading', { name: /Where are you looking/ })).toBeInTheDocument();
    await advance(user, 1);
    expect(screen.getByRole('heading', { name: /budget & space/i })).toBeInTheDocument();
    await advance(user, 1);
    expect(screen.getByRole('heading', { name: /What matters most/ })).toBeInTheDocument();
    await advance(user, 1);
    expect(screen.getByRole('heading', { name: /Ready to match/ })).toBeInTheDocument();
  });

  // ---- Regression ----
  // React reconciled the Continue and Submit buttons into one DOM node and only
  // flipped `type`, so the browser ran its default action against a button that
  // had already become type="submit". Reaching step 4 therefore submitted the
  // form and navigated straight to /results, skipping Review entirely.
  it('does not submit when advancing onto the final step', async () => {
    const user = userEvent.setup();
    renderWizard();

    await advance(user, 3);

    expect(screen.getByRole('heading', { name: /Ready to match/ })).toBeInTheDocument();
    expect(screen.queryByText('RESULTS PAGE')).not.toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
  });

  it('shows Continue until the last step, then the submit action', async () => {
    const user = userEvent.setup();
    renderWizard();

    for (let step = 1; step <= 3; step++) {
      expect(screen.getByRole('button', { name: /Continue/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /See my matches/ })).not.toBeInTheDocument();
      await advance(user, 1);
    }
    expect(screen.getByRole('button', { name: /See my matches/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue/ })).not.toBeInTheDocument();
  });

  it('runs the search and navigates only when the user submits from Review', async () => {
    const user = userEvent.setup();
    renderWizard();

    await advance(user, 3);
    await user.click(screen.getByRole('button', { name: /See my matches/ }));

    await waitFor(() => expect(screen.getByText('RESULTS PAGE')).toBeInTheDocument());
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('can go back, and Back is disabled on the first step', async () => {
    const user = userEvent.setup();
    renderWizard();

    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled();
    await advance(user, 2);
    expect(screen.getByRole('heading', { name: /What matters most/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('heading', { name: /budget & space/i })).toBeInTheDocument();
  });

  it('lets the rail jump straight to a step', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('button', { name: /Step 4: Review/ }));
    expect(screen.getByRole('heading', { name: /Ready to match/ })).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
  });

  // Enter inside a text field submits a form natively. Mid-wizard that would run
  // the search before the user had answered everything.
  it('treats Enter in a field as Continue rather than as submit', async () => {
    const user = userEvent.setup();
    renderWizard();

    await advance(user, 2); // step 3 has no free-text field; step 2 does
    await user.click(screen.getByRole('button', { name: /Back/ }));

    const income = screen.getByPlaceholderText(/6,500/);
    await user.click(income);
    await user.keyboard('{Enter}');

    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByText('RESULTS PAGE')).not.toBeInTheDocument();
  });

  it('carries the user’s answers through to the review summary', async () => {
    const user = userEvent.setup();
    renderWizard();

    // Step 1 has two comboboxes (city, and the address field's type-ahead), so
    // target the city by its label rather than by role alone.
    await user.selectOptions(screen.getByLabelText('City'), 'Austin');
    await advance(user, 3);

    expect(screen.getByRole('heading', { name: /Ready to match/ })).toBeInTheDocument();
    expect(screen.getByText('Austin')).toBeInTheDocument();
  });
});
