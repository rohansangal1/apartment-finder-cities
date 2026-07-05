import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch, DEFAULT_CRITERIA } from '../context/search-context';
import { useUserData } from '../context/user-data-context';
import AddressAutocomplete from '../components/address-autocomplete';
import ApartmentCarousel from '../components/apartment-carousel';
import type { SearchCriteria, CommuteMode, Weights } from '../lib/types';
import type { SavedSearch } from '../lib/user-data/types';

/** Hero backdrop. A warm, sunlit interior — swap by pointing this at another asset. */
const HERO_IMAGE = '/images/apt-loft.jpg';

/** Cities we have inventory for. On the live API source RentCast covers any US
 * city, so this list is just a convenient set of starting points. */
const CITIES = ['Boston', 'New York', 'San Francisco', 'Austin', 'Chicago', 'Seattle', 'Los Angeles'];
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
 * Onboarding: collect the user's situation in a calm, guided flow. Priorities
 * are expressed as 0–1 weight sliders (the scorer normalizes them), which is
 * more expressive than a strict ranking and maps 1:1 to SearchCriteria.weights.
 */
export default function InputView() {
  const navigate = useNavigate();
  const { criteria, search } = useSearch();
  const { getPreferences, savedAddresses, saveAddress, savedSearches, deleteSearch } =
    useUserData();
  const [form, setForm] = useState<SearchCriteria>(criteria || DEFAULT_CRITERIA);
  // Brief inline feedback after saving the typed work address for reuse.
  const [addrSaved, setAddrSaved] = useState(false);
  // Which saved search was just applied, for a brief "Applied ✓" confirmation.
  const [appliedId, setAppliedId] = useState<string | null>(null);

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
            monthlyIncome: prefs.monthlyIncome ?? f.monthlyIncome,
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

  // Persist the typed work address for reuse. Default its label to the text
  // before the first comma ("Salesforce Tower"); users can manage these on the
  // Searches page.
  const saveTypedAddress = async () => {
    const address = (form.workAddress ?? '').trim();
    if (!address) return;
    const label = (address.split(',')[0] || address).slice(0, 120);
    try {
      await saveAddress(label, address);
      setAddrSaved(true);
      setTimeout(() => setAddrSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save address', e);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(form);
    navigate('/results');
  };

  // Apply a saved search's parameters into the form (does NOT run it) so the user
  // can review/tweak and then hit "Show me matches" themselves.
  const applySaved = (id: string, c: SearchCriteria) => {
    setForm(c);
    setAppliedId(id);
    setTimeout(() => setAppliedId((cur) => (cur === id ? null : cur)), 2000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* ---- Hero ---- */}
      <section className="animate-fadeup overflow-hidden rounded-3xl bg-paper-cream shadow-soft-lg">
        <div className="grid items-stretch sm:grid-cols-2">
          <div className="order-2 flex flex-col justify-center px-7 py-9 sm:order-1 sm:px-10 sm:py-14">
            <span
              className="animate-fadeup text-xs font-semibold uppercase tracking-[0.22em] text-brand-700"
              style={{ animationDelay: '60ms' }}
            >
              Apartment finding, made human
            </span>
            <h1
              className="mt-4 animate-fadeup font-serif text-5xl leading-[1.02] tracking-tight text-slate-900 sm:text-6xl"
              style={{ animationDelay: '140ms' }}
            >
              Find a place that{' '}
              <span className="relative inline-block">
                fits
                <span className="absolute inset-x-0 -bottom-0.5 h-[3px] rounded-full bg-terracotta-600" />
              </span>{' '}
              your life
            </h1>
            <p
              className="mt-4 max-w-md animate-fadeup text-base leading-relaxed text-slate-600"
              style={{ animationDelay: '220ms' }}
            >
              Tell us a little about your days — your commute, your budget, the space you need — and
              we'll gently rank homes by how well they fit. No endless scrolling.
            </p>
            <dl
              className="mt-6 flex animate-fadeup gap-6 border-t border-ink-600/60 pt-5"
              style={{ animationDelay: '300ms' }}
            >
              {[
                { v: '4', l: 'priorities weighed' },
                { v: '7', l: 'cities to start' },
                { v: '30s', l: 'to your matches' },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="data text-2xl font-semibold text-slate-900">{s.v}</dt>
                  <dd className="mt-0.5 text-[11px] uppercase tracking-wide text-slate-400">{s.l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="order-1 min-h-[220px] sm:order-2 sm:min-h-[380px]">
            <img
              src={HERO_IMAGE}
              alt="A warm, sunlit apartment interior"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ---- Saved searches: tap a card to scaffold its parameters into the
              form below (it doesn't run the search — the user reviews, then
              submits). ---- */}
      {savedSearches.length > 0 && (
        <section className="animate-fadeup" style={{ animationDelay: '40ms' }}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">
              Your saved searches
            </h2>
            <span className="hidden text-xs text-slate-400 sm:block">
              Tap one to fill the form below
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {savedSearches.map((s) => (
              <SavedSearchCard
                key={s.id}
                saved={s}
                applied={appliedId === s.id}
                onApply={() => applySaved(s.id, s.criteria)}
                onDelete={() => void deleteSearch(s.id)}
              />
            ))}
          </div>
        </section>
      )}

      <form onSubmit={onSubmit} className="space-y-6 sm:space-y-8">
        {/* ---- 1 · Where ---- */}
        <GroupCard step={1} title="Where are you looking?" delay={60}>
          <Field label="City">
            <div className="relative">
              <select
                value={form.city}
                onChange={(e) => set({ city: e.target.value })}
                className="input appearance-none pr-10"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Chevron className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </Field>

          <Field label="Where do you work?">
            <div className="grid grid-cols-2 gap-2.5">
              <Pill active={form.inPerson} onClick={() => set({ inPerson: true })} label="In person" />
              <Pill active={!form.inPerson} onClick={() => set({ inPerson: false })} label="Remote" />
            </div>
          </Field>

          {form.inPerson && (
            <Field label="Work address" hint="We estimate your commute from here.">
              {/* Quick-pick from saved addresses so users don't retype. */}
              {savedAddresses.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {savedAddresses.map((a) => {
                    const active = (form.workAddress ?? '').trim() === a.address;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => set({ workAddress: a.address })}
                        aria-pressed={active}
                        title={a.address}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          active
                            ? 'bg-sage text-brand-700 shadow-[inset_0_0_0_1.5px_rgba(63,107,84,0.35)]'
                            : 'bg-ink-700 text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              )}
              <AddressAutocomplete
                value={form.workAddress ?? ''}
                onChange={(workAddress) => set({ workAddress })}
                placeholder="e.g. Salesforce Tower, San Francisco"
                className="input"
              />
              {/* Offer to save a freshly typed address for reuse next time. */}
              {(() => {
                const address = (form.workAddress ?? '').trim();
                if (!address) return null;
                const alreadySaved = savedAddresses.some((a) => a.address === address);
                if (alreadySaved) return null;
                return (
                  <button
                    type="button"
                    onClick={saveTypedAddress}
                    className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    {addrSaved ? '✓ Saved for next time' : '+ Save this address for next time'}
                  </button>
                );
              })()}
            </Field>
          )}
        </GroupCard>

        {/* ---- 2 · Budget & space ---- */}
        <GroupCard step={2} title="Your budget & space" delay={120}>
          <Field
            label={
              <span>
                Max rent <span className="data text-brand-700">${form.maxRent.toLocaleString()}</span> / month
              </span>
            }
          >
            <Slider min={800} max={8000} step={50} value={form.maxRent} onChange={(v) => set({ maxRent: v })} />
          </Field>

          <Field
            label="Monthly take-home"
            hint="Optional — we'll flag how each rent sits against the 30% rule."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                $
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                placeholder="e.g. 6,500"
                value={form.monthlyIncome ?? ''}
                onChange={(e) =>
                  set({ monthlyIncome: e.target.value ? Number(e.target.value) : undefined })
                }
                className="input pl-7"
              />
            </div>
          </Field>

          <Field label="Bedrooms">
            <div className="grid grid-cols-4 gap-2.5">
              {[0, 1, 2, 3].map((b) => (
                <Pill
                  key={b}
                  active={form.bedrooms === b}
                  onClick={() => set({ bedrooms: b })}
                  label={b === 0 ? 'Studio' : `${b}`}
                />
              ))}
            </div>
          </Field>

          {form.inPerson && (
            <Field label="How do you like to get around?">
              <div className="grid grid-cols-4 gap-2.5">
                {COMMUTE_MODES.map((m) => (
                  <Pill
                    key={m.value}
                    active={form.commuteMode === m.value}
                    onClick={() => set({ commuteMode: m.value })}
                    label={
                      <span className="flex flex-col items-center gap-1">
                        <span className="text-lg">{m.icon}</span>
                        <span className="text-xs">{m.label}</span>
                      </span>
                    }
                  />
                ))}
              </div>
            </Field>
          )}
        </GroupCard>

        {/* ---- 3 · Priorities ---- */}
        <GroupCard
          step={3}
          title="What matters most to you?"
          subtitle="Slide up the things you care about — we'll weigh them into every match."
          delay={180}
        >
          <div className="space-y-6">
            {PRIORITIES.map((p) => {
              // Remote workers don't have a commute to weigh.
              if (p.key === 'commute' && !form.inPerson) return null;
              return (
                <div key={p.key}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-sm font-medium text-slate-800">{p.label}</span>
                    <span className="text-xs text-slate-400">{p.hint}</span>
                  </div>
                  <Slider min={0} max={1} step={0.1} value={form.weights[p.key]} onChange={(v) => setWeight(p.key, v)} />
                </div>
              );
            })}
          </div>
        </GroupCard>

        {/* ---- CTA ---- */}
        <div className="animate-fadeup pt-1" style={{ animationDelay: '240ms' }}>
          <button
            type="submit"
            className="w-full rounded-2xl bg-brand-600 px-4 py-4 text-base font-semibold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-soft-lg active:translate-y-0"
          >
            Show me matches
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">Takes about 30 seconds ✦ No account needed</p>
        </div>
      </form>

      {/* ---- Featured spaces ---- */}
      <section className="animate-fadeup" style={{ animationDelay: '300ms' }}>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">Featured spaces</h2>
          <span className="hidden text-xs text-slate-400 sm:block">A look at places people love</span>
        </div>
        <ApartmentCarousel />
      </section>
    </div>
  );
}

/** Short chip summary of a saved search's parameters, for recognition at a glance. */
function summarize(c: SearchCriteria): string[] {
  const chips = [
    c.city,
    c.bedrooms === 0 ? 'Studio' : `${c.bedrooms} bd`,
    `≤ $${c.maxRent.toLocaleString()}/mo`,
    c.inPerson ? `${c.commuteMode} commute` : 'Remote',
  ];
  if (c.inPerson && c.workAddress) chips.push(`from ${c.workAddress}`);
  if (c.monthlyIncome) chips.push(`$${c.monthlyIncome.toLocaleString()}/mo income`);
  return chips;
}

/**
 * A clickable saved-search card. The whole card applies its parameters to the
 * form (onApply); a small ✕ deletes it (stopPropagation so it doesn't also
 * apply). Shows a brief "Applied ✓" state after a tap.
 */
function SavedSearchCard({
  saved,
  applied,
  onApply,
  onDelete,
}: {
  saved: SavedSearch;
  applied: boolean;
  onApply: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onApply}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onApply();
        }
      }}
      className={`group relative cursor-pointer rounded-2xl border bg-ink p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft-lg ${
        applied ? 'border-brand-400 ring-2 ring-brand-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate pr-6 font-semibold text-slate-900">{saved.name}</p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete saved search ${saved.name}`}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-rose-500"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2m-9 0v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" />
          </svg>
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {summarize(saved.criteria).map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
          >
            {chip}
          </span>
        ))}
      </div>
      <p className="mt-2.5 text-xs font-medium text-brand-600">
        {applied ? '✓ Applied — review below and search' : 'Tap to fill the form →'}
      </p>
    </div>
  );
}

/** A soft labeled group in the guided form — numbered step, title, breathing room. */
function GroupCard({
  step,
  title,
  subtitle,
  delay = 0,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <section className="card animate-fadeup p-6 sm:p-8" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sage font-serif text-sm font-semibold text-brand-700">
          {step}
        </span>
        <div>
          <h2 className="font-serif text-xl font-semibold leading-tight tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

/** Filled-pill toggle — pale sage fill when selected, calm neutral otherwise. */
function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
        active
          ? 'bg-sage text-brand-700 shadow-[inset_0_0_0_1.5px_rgba(63,107,84,0.35)]'
          : 'bg-ink-700 text-slate-600 shadow-soft hover:-translate-y-px hover:text-slate-800'
      }`}
    >
      {label}
    </button>
  );
}

/** Green-filled range slider with a soft-shadow thumb (see .slider in index.css). */
function Slider({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="slider"
      style={{ ['--pct' as string]: `${pct}%` }}
    />
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
