import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch, DEFAULT_CRITERIA } from '../context/SearchContext';
import { useUserData } from '../context/UserDataContext';
import type { SearchCriteria, CommuteMode, Weights } from '../lib/types';

/** Cities we have (mock) inventory for. Real backend would discover this dynamically. */
const CITIES = ['San Francisco', 'New York', 'Austin'];
const COMMUTE_MODES: Array<{ value: CommuteMode; label: string; icon: string }> = [
  { value: 'walk', label: 'Walk', icon: '🚶' },
  { value: 'transit', label: 'Transit', icon: '🚆' },
  { value: 'bike', label: 'Bike', icon: '🚲' },
  { value: 'drive', label: 'Drive', icon: '🚗' },
];
const PRIORITIES: Array<{ key: keyof Weights; label: string; hint: string }> = [
  { key: 'commute', label: 'Short commute', hint: 'Closer to work' },
  { key: 'price', label: 'Low price', hint: 'More under budget' },
  { key: 'rating', label: 'High ratings', hint: 'Well-reviewed buildings' },
  { key: 'space', label: 'More space', hint: 'Extra bedrooms' },
];

/**
 * Onboarding: collect the user's situation. Priorities are expressed as 0–1
 * weight sliders (the scorer normalizes them), which is more expressive than a
 * strict ranking and maps 1:1 to the SearchCriteria.weights shape.
 */
export default function InputView() {
  const navigate = useNavigate();
  const { criteria, search } = useSearch();
  const { getPreferences } = useUserData();
  const [form, setForm] = useState<SearchCriteria>(criteria || DEFAULT_CRITERIA);

  // Pre-fill from saved defaults (signed-in users skip re-entering their situation).
  // Only applies when the form is still at the untouched default, so it never
  // clobbers edits the user has already made this session.
  useEffect(() => {
    let cancelled = false;
    getPreferences()
      .then((prefs) => {
        if (!prefs || cancelled) return;
        setForm((f) => {
          if (f !== DEFAULT_CRITERIA) return f; // user already interacted
          return {
            ...f,
            city: prefs.homeCity ?? f.city,
            workAddress: prefs.workAddress ?? f.workAddress,
            commuteMode: prefs.commuteMode ?? f.commuteMode,
            weights: prefs.weights ?? f.weights,
          };
        });
      })
      .catch((e) => console.error('Failed to load preferences', e));
    return () => {
      cancelled = true;
    };
  }, [getPreferences]);

  const set = (patch: Partial<SearchCriteria>) => setForm((f) => ({ ...f, ...patch }));
  const setWeight = (key: keyof Weights, value: number) =>
    setForm((f) => ({ ...f, weights: { ...f.weights, [key]: value } }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(form);
    navigate('/results');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Find your next place</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tell us your situation and we'll rank apartments by how well they fit — no endless scrolling.
        </p>
      </header>

      {/* City */}
      <Field label="City">
        <select value={form.city} onChange={(e) => set({ city: e.target.value })} className="input">
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      {/* Work style */}
      <Field label="Where do you work?">
        <div className="grid grid-cols-2 gap-2">
          <Segment active={form.inPerson} onClick={() => set({ inPerson: true })} label="In person" />
          <Segment active={!form.inPerson} onClick={() => set({ inPerson: false })} label="Remote" />
        </div>
      </Field>

      {/* Work address (in-person only) */}
      {form.inPerson && (
        <Field
          label="Work address"
          hint="We estimate commute from here. Try 'Salesforce Tower' or 'Midtown'."
        >
          <input
            type="text"
            value={form.workAddress}
            onChange={(e) => set({ workAddress: e.target.value })}
            placeholder="e.g. Salesforce Tower, San Francisco"
            className="input"
          />
        </Field>
      )}

      {/* Budget + bedrooms */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`Max rent — $${form.maxRent.toLocaleString()}/mo`}>
          <input
            type="range"
            min="800"
            max="8000"
            step="50"
            value={form.maxRent}
            onChange={(e) => set({ maxRent: Number(e.target.value) })}
            className="w-full accent-brand-600"
          />
        </Field>
        <Field label="Bedrooms">
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((b) => (
              <Segment
                key={b}
                active={form.bedrooms === b}
                onClick={() => set({ bedrooms: b })}
                label={b === 0 ? 'Studio' : `${b}`}
              />
            ))}
          </div>
        </Field>
      </div>

      {/* Commute mode */}
      {form.inPerson && (
        <Field label="Preferred commute mode">
          <div className="grid grid-cols-4 gap-2">
            {COMMUTE_MODES.map((m) => (
              <Segment
                key={m.value}
                active={form.commuteMode === m.value}
                onClick={() => set({ commuteMode: m.value })}
                label={
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="text-lg">{m.icon}</span>
                    <span className="text-xs">{m.label}</span>
                  </span>
                }
              />
            ))}
          </div>
        </Field>
      )}

      {/* Priorities */}
      <div>
        <p className="text-sm font-semibold text-slate-700">What matters most?</p>
        <p className="mb-3 text-xs text-slate-400">
          Slide up the things you care about. We normalize these into your match score.
        </p>
        <div className="space-y-4">
          {PRIORITIES.map((p) => {
            // Remote workers don't have a commute to weigh.
            if (p.key === 'commute' && !form.inPerson) return null;
            return (
              <div key={p.key}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{p.label}</span>
                  <span className="text-xs text-slate-400">{p.hint}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={form.weights[p.key]}
                  onChange={(e) => setWeight(p.key, Number(e.target.value))}
                  className="mt-1 w-full accent-brand-600"
                />
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-brand-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        Show me matches
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Segment({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
        active
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  );
}
