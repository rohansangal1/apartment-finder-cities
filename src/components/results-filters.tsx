import { useMemo, useState } from 'react';
import type { ScoredListing } from '../lib/types';

/**
 * Client-side refinement of an already-scored result set. This never re-runs the
 * search — it narrows what's already ranked, so it stays instant. Controls are
 * derived from the current results (rent range, most common tags) so they only
 * ever offer choices that can actually match something.
 */
export interface ResultFilters {
  /** Hide listings over this rent. 0 = no cap. */
  maxRent: number;
  /** Minimum bedrooms. 0 = any (studios included). */
  minBeds: number;
  /** Minimum match score. 0 = any. */
  minScore: number;
  /** Required tags (a listing must have ALL of these). */
  tags: string[];
}

export const EMPTY_FILTERS: ResultFilters = { maxRent: 0, minBeds: 0, minScore: 0, tags: [] };

/** Does a scored listing pass the active filters? Exported so the view filters with
 * the exact same predicate the controls are built from. */
export function matchesFilters(s: ScoredListing, f: ResultFilters): boolean {
  if (f.maxRent > 0 && s.listing.rentMonthly > f.maxRent) return false;
  if (f.minBeds > 0 && s.listing.bedrooms < f.minBeds) return false;
  if (f.minScore > 0 && s.matchScore < f.minScore) return false;
  if (f.tags.length && !f.tags.every((t) => s.listing.tags.includes(t))) return false;
  return true;
}

/** How many dimensions are actively constraining the results. */
export function activeFilterCount(f: ResultFilters): number {
  return (
    (f.maxRent > 0 ? 1 : 0) +
    (f.minBeds > 0 ? 1 : 0) +
    (f.minScore > 0 ? 1 : 0) +
    f.tags.length
  );
}

const SCORE_CHIPS = [60, 70, 80];

export default function ResultsFilters({
  results,
  filters,
  onChange,
}: {
  results: ScoredListing[];
  filters: ResultFilters;
  onChange: (next: ResultFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(filters);

  // Derive rent cap steps from the actual result range (rounded to nice $250s).
  const rentSteps = useMemo(() => {
    if (results.length === 0) return [];
    const rents = results.map((r) => r.listing.rentMonthly);
    const min = Math.min(...rents);
    const max = Math.max(...rents);
    if (min === max) return [];
    const lo = Math.ceil(min / 250) * 250;
    const hi = Math.ceil(max / 250) * 250;
    const steps: number[] = [];
    const stride = Math.max(250, Math.round((hi - lo) / 4 / 250) * 250);
    for (let v = lo; v < hi; v += stride) steps.push(v);
    return steps;
  }, [results]);

  // Most common tags across the results (up to 10).
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results) for (const t of r.listing.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  }, [results]);

  const toggleTag = (t: string) =>
    onChange({
      ...filters,
      tags: filters.tags.includes(t) ? filters.tags.filter((x) => x !== t) : [...filters.tags, t],
    });

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-ink px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          <FilterIcon />
          Refine
          {active > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-100 px-1 text-xs font-semibold text-brand-700">
              {active}
            </span>
          )}
        </button>
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Clear all
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-ink p-4 motion-safe:animate-fadeup">
          <div className="grid gap-4 sm:grid-cols-2">
            {rentSteps.length > 0 && (
              <Control label="Max rent">
                <select
                  value={filters.maxRent}
                  onChange={(e) => onChange({ ...filters, maxRent: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 bg-ink-700 px-2.5 py-1.5 text-sm text-slate-700"
                >
                  <option value={0}>Any</option>
                  {rentSteps.map((v) => (
                    <option key={v} value={v}>
                      Under ${v.toLocaleString()}
                    </option>
                  ))}
                </select>
              </Control>
            )}
            <Control label="Bedrooms">
              <select
                value={filters.minBeds}
                onChange={(e) => onChange({ ...filters, minBeds: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 bg-ink-700 px-2.5 py-1.5 text-sm text-slate-700"
              >
                <option value={0}>Any</option>
                <option value={1}>1+</option>
                <option value={2}>2+</option>
                <option value={3}>3+</option>
              </select>
            </Control>
          </div>

          <Control label="Minimum match">
            <div className="flex gap-2">
              {SCORE_CHIPS.map((s) => (
                <Chip
                  key={s}
                  active={filters.minScore === s}
                  onClick={() =>
                    onChange({ ...filters, minScore: filters.minScore === s ? 0 : s })
                  }
                >
                  {s}+
                </Chip>
              ))}
            </div>
          </Control>

          {topTags.length > 0 && (
            <Control label="Must have">
              <div className="flex flex-wrap gap-2">
                {topTags.map((t) => (
                  <Chip key={t} active={filters.tags.includes(t)} onClick={() => toggleTag(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </Control>
          )}
        </div>
      )}
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
        active
          ? 'text-brand-600 shadow-[inset_0_0_0_1px_#9184d9]'
          : 'bg-ink-700 text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function FilterIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}
