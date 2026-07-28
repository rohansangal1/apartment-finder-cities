import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSearch, DEFAULT_CRITERIA } from '../context/search-context';
import { useUserData } from '../context/user-data-context';
import AddressAutocomplete from '../components/address-autocomplete';
import ApartmentCarousel from '../components/apartment-carousel';
import WizardSteps from '../components/wizard-steps';
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
/** The wizard's four pages, in order. Index + 1 is the step number. */
const STEP_LABELS = ['Location', 'Budget & space', 'Priorities', 'Review'];
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
  // Which page of the wizard is showing (1-based, to match the rail's numbers).
  const [step, setStep] = useState(1);
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
    // Enter inside a text field submits the form natively. Mid-wizard that would
    // fire the search before the user has answered everything, so treat it as
    // "Continue" and only let the last step actually run the search.
    if (step < STEP_LABELS.length) {
      setStep((s) => s + 1);
      return;
    }
    search(form);
    navigate('/results');
  };

  // Apply a saved search's parameters into the form (does NOT run it) so the user
  // can review/tweak and then hit "See my matches" themselves. Every field is
  // already filled, so it lands on Review rather than walking step 1 again.
  const applySaved = (id: string, c: SearchCriteria) => {
    setForm(c);
    setStep(STEP_LABELS.length);
    setAppliedId(id);
    setTimeout(() => setAppliedId((cur) => (cur === id ? null : cur)), 2000);
    document.getElementById('wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-12 sm:space-y-16">
      {/* ---- Hero ----
           Nocturne is left-aligned and asymmetric: the copy hugs the left edge
           and the photograph carries the right, with no panel drawn around the
           pair. The one accent flourish is the hand-drawn underline stroke. */}
      <section className="grid items-center gap-10 sm:grid-cols-[1.05fr_0.95fr] sm:gap-14">
        <div>
          <div
            className="animate-fadeup mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700"
            style={{ animationDelay: '60ms' }}
          >
            <span className="h-[1.5px] w-[22px] bg-brand-600" />
            Apartment finding, made human
          </div>
          <h1
            className="animate-fadeup text-5xl leading-[0.98] tracking-[-0.035em] text-slate-900 sm:text-[68px]"
            style={{ animationDelay: '140ms' }}
          >
            Find a place
            <br />
            that fits
            <br />
            <span className="relative inline-block">
              your life
              <svg
                viewBox="0 0 280 14"
                preserveAspectRatio="none"
                className="absolute -bottom-2.5 left-0 h-3.5 w-full"
              >
                <path
                  d="M2 9 C 80 2, 200 12, 278 5"
                  stroke="#9184d9"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
          </h1>
          <p
            className="mt-7 max-w-md animate-fadeup text-lg leading-relaxed text-slate-600"
            style={{ animationDelay: '220ms' }}
          >
            Tell us a little about your days — your commute, your budget, the space you need — and
            we'll gently rank homes by how well they fit. No endless scrolling.
          </p>
          {/* The design's hero pair. "See how it ranks" is the one route into
              the scoring explainer that a first-time visitor meets before
              they've searched — every other link to it sits on a page you only
              reach afterwards. */}
          <div className="mt-8 flex animate-fadeup flex-wrap gap-3.5" style={{ animationDelay: '260ms' }}>
            <button
              type="button"
              onClick={() =>
                document.getElementById('wizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="btn-outline px-5 py-3 text-[15px]"
            >
              Start matching →
            </button>
            <Link
              to="/how-it-works"
              className="inline-flex items-center rounded-lg border border-ink-600 px-5 py-3 text-[15px] font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              See how it ranks
            </Link>
          </div>
          <div className="hr my-8" />
          <dl className="flex animate-fadeup gap-12" style={{ animationDelay: '300ms' }}>
            {[
              { v: '4', l: 'Priorities weighed' },
              { v: '7', l: 'Cities to start' },
              { v: '30s', l: 'To your matches' },
            ].map((s) => (
              <div key={s.l}>
                <dt className="data text-[34px] tracking-[-0.02em] text-slate-900">{s.v}</dt>
                <dd className="mt-1 max-w-[110px] text-[11px] uppercase leading-tight tracking-[0.06em] text-slate-400">
                  {s.l}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-2xl shadow-soft-lg" style={{ aspectRatio: '6 / 5' }}>
            <img
              src={HERO_IMAGE}
              alt="A warm, sunlit apartment interior"
              className="lighten h-full w-full object-cover"
            />
          </div>
          {/* Detached overlay card — the design's proof that the ranking is live. */}
          <div className="card animate-float absolute -bottom-6 -left-4 w-[230px] p-4 shadow-soft-lg sm:-left-7">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.1em] text-brand-600">
                Live fit score
              </span>
              <span className="rounded-md bg-brand-100 px-2.5 py-0.5 text-[11px] text-brand-700">
                94%
              </span>
            </div>
            <div className="mt-1.5 text-[15px] text-slate-900">1200 Fillmore St, Unit 4</div>
            <div className="mt-1 text-[11px] text-slate-400">
              18 min commute · Fits 3 of 4 priorities
            </div>
          </div>
        </div>
      </section>

      {/* ---- Saved searches: tap a card to scaffold its parameters into the
              form below (it doesn't run the search — the user reviews, then
              submits). ---- */}
      {savedSearches.length > 0 && (
        <section className="animate-fadeup" style={{ animationDelay: '40ms' }}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-2xl tracking-tight text-slate-900">
              Your saved searches
            </h2>
            <span className="hidden text-xs text-slate-400 sm:block">
              Apply one to fill the form below
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

      {/* ---- The guided wizard ----
           One question at a time, on a single card, with the rail above it
           carrying progress. Steps are all mounted-on-demand, so the browser
           never has to reconcile four screens of fields at once. */}
      <form id="wizard" onSubmit={onSubmit} className="card p-6 sm:p-10">
        <WizardSteps labels={STEP_LABELS} current={step} onJump={setStep} />

        {step === 1 && (
        <StepPanel
          key={step}
          title="Where are you looking?"
          subtitle="Pick a city to start — you can compare neighbourhoods later."
        >
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
        </StepPanel>
        )}

        {step === 2 && (
        <StepPanel
          key={step}
          title="Your budget & space"
          subtitle="We'll rank listings by how well they hold both."
        >
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

        </StepPanel>
        )}

        {step === 3 && (
        <StepPanel
          key={step}
          title="What matters most to you?"
          subtitle="Slide up the things you care about — we'll weigh them into every match."
        >
          {/* Remote searches have no commute to plan, so the mode picker only
              appears when there's a journey to make. */}
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
        </StepPanel>
        )}

        {step === 4 && (
        <StepPanel
          key={step}
          title="Ready to match"
          subtitle={`We'll rank ${form.city} listings against your priorities in about 30 seconds.`}
        >
          {/* The one accent-tinted surface in the flow — it marks the end of the
              wizard without the accent flooding anything. */}
          <div
            className="max-w-lg rounded-xl border border-brand-200 p-5"
            style={{ background: 'color-mix(in srgb, #9184d9 8%, #232532)' }}
          >
            <div className="text-base text-slate-900">Summary</div>
            <dl className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-slate-600">
              <SummaryRow label="City" value={form.city} />
              <SummaryRow
                label="Bedrooms"
                value={form.bedrooms === 0 ? 'Studio' : `${form.bedrooms} bedroom${form.bedrooms > 1 ? 's' : ''}`}
              />
              <SummaryRow label="Max rent" value={`$${form.maxRent.toLocaleString()} / month`} />
              {form.monthlyIncome ? (
                <SummaryRow
                  label="Take-home"
                  value={`$${form.monthlyIncome.toLocaleString()} / month`}
                />
              ) : null}
              <SummaryRow
                label="Commute"
                value={
                  form.inPerson
                    ? `${commuteLabel(form.commuteMode)}${
                        form.workAddress ? ` from ${form.workAddress}` : ''
                      }`
                    : 'Remote — no commute weighed'
                }
              />
              <SummaryRow
                label="Priorities weighed"
                value={(({ active, total }) => `${active} of ${total}`)(activePriorities(form))}
              />
            </dl>
          </div>
          <p className="text-xs text-slate-400">Takes about 30 seconds ✦ No account needed</p>
        </StepPanel>
        )}

        {/* ---- Wizard controls ---- */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="rounded-lg border border-ink-600 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Back
          </button>
          {/* The keys matter. Without them React reconciles these two into the
              same DOM node and only flips `type`, so the final Continue click
              lands on a button that has already become type="submit" by the time
              the browser runs its default action — advancing to Review and
              immediately submitting from it. Distinct keys force a fresh node. */}
          {step === STEP_LABELS.length ? (
            /* Nocturne outlines its primary action rather than flooding it with
               accent — the fill is reserved for the brand mark. */
            <button key="submit" type="submit" className="btn-outline px-7 py-2.5 text-[15px]">
              See my matches →
            </button>
          ) : (
            <button
              key="continue"
              type="button"
              onClick={() => setStep((s) => Math.min(STEP_LABELS.length, s + 1))}
              className="btn-outline px-7 py-2.5 text-[15px]"
            >
              Continue →
            </button>
          )}
        </div>
      </form>

      {/* ---- Featured spaces ---- */}
      <section className="animate-fadeup" style={{ animationDelay: '300ms' }}>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-2xl tracking-tight text-slate-900">Featured spaces</h2>
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
 * A saved-search card. Applying is an explicit two-step action: an "Apply to
 * search" button reveals a confirm/cancel prompt (so a stray click never wipes
 * what's already in the form), and only "Apply" actually scaffolds the criteria
 * in. A small ✕ deletes the saved search.
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
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={`relative rounded-2xl border bg-ink p-4 shadow-sm transition ${
        applied ? 'border-brand-400 ring-2 ring-brand-200' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate pr-6 font-semibold text-slate-900">{saved.name}</p>
        <button
          type="button"
          onClick={onDelete}
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

      {applied ? (
        <p className="mt-3 text-xs font-medium text-brand-600">
          ✓ Applied — review the form below and search
        </p>
      ) : confirming ? (
        <div className="mt-3">
          <p className="text-xs text-slate-500">
            Apply this search? It will replace what's currently in the form below.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onApply();
                setConfirming(false);
              }}
              className="btn-outline rounded-lg px-3 py-1.5 text-xs"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
        >
          Apply to search
        </button>
      )}
    </div>
  );
}

/**
 * One page of the wizard. The rail above already carries the step number, so
 * the panel is just a heading, a line of orientation, and the fields — keyed on
 * the step so React remounts it and the fade replays on every advance.
 */
function StepPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="motion-safe:animate-fadeup">
      <h2 className="text-[25px] leading-tight tracking-tight text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-7 max-w-2xl space-y-5">{children}</div>
    </section>
  );
}

/** One label/value line in the review step's summary. */
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="flex-none text-slate-400">{label}:</dt>
      <dd className="min-w-0 text-slate-700">{value}</dd>
    </div>
  );
}

function commuteLabel(mode: CommuteMode): string {
  return COMMUTE_MODES.find((m) => m.value === mode)?.label ?? mode;
}

/**
 * How many priorities the user actually leaned on (anything above indifferent),
 * over how many were on offer — remote searches never see the commute slider,
 * so counting it against them would overstate the denominator.
 */
function activePriorities(form: SearchCriteria): { active: number; total: number } {
  const offered = PRIORITIES.filter((p) => p.key !== 'commute' || form.inPerson);
  return {
    active: offered.filter((p) => form.weights[p.key] > 0.5).length,
    total: offered.length,
  };
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
