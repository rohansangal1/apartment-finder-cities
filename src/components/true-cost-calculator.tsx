import { useState } from 'react';
import type { CommuteMode } from '../lib/types';
import {
  DEFAULT_ASSUMPTIONS,
  trueMonthlyCost,
  type TrueCostAssumptions,
} from '../lib/true-cost';
import { formatRent } from '../lib/format';

/**
 * "True cost" section for a listing: rent plus rough estimated utilities and
 * commute cost, recomputed live as the user adjusts office days / whether
 * utilities are included. Estimates are intentionally ballpark (see true-cost.ts)
 * and labeled as such.
 */
export default function TrueCostCalculator({
  rent,
  bedrooms,
  commuteMode,
  oneWayMinutes,
}: {
  rent: number;
  bedrooms: number;
  commuteMode: CommuteMode;
  /** One-way commute minutes; 0 for remote searches (commute cost → $0). */
  oneWayMinutes: number;
}) {
  const [a, setA] = useState<TrueCostAssumptions>(DEFAULT_ASSUMPTIONS);
  const { utilities, commute, total } = trueMonthlyCost(rent, bedrooms, commuteMode, oneWayMinutes, a);
  const remote = oneWayMinutes <= 0;

  return (
    <section className="card p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">True monthly cost</h2>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Office days / week</span>
          <div className="flex items-center gap-2">
            <Stepper
              label="−"
              onClick={() =>
                setA((s) => ({ ...s, officeDaysPerWeek: Math.max(0, s.officeDaysPerWeek - 1) }))
              }
              disabled={a.officeDaysPerWeek <= 0}
            />
            <span className="data w-4 text-center text-sm font-semibold text-slate-900">
              {a.officeDaysPerWeek}
            </span>
            <Stepper
              label="+"
              onClick={() =>
                setA((s) => ({ ...s, officeDaysPerWeek: Math.min(7, s.officeDaysPerWeek + 1) }))
              }
              disabled={a.officeDaysPerWeek >= 7}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={a.utilitiesIncluded}
            onChange={(e) => setA((s) => ({ ...s, utilitiesIncluded: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 accent-brand-600"
          />
          Utilities included in rent
        </label>
      </div>

      {/* Breakdown */}
      <dl className="mt-4 space-y-1.5">
        <CostRow label="Rent" value={rent} />
        <CostRow
          label="Utilities (est.)"
          value={utilities}
          hint={a.utilitiesIncluded ? 'included' : undefined}
        />
        <CostRow
          label="Commute (est.)"
          value={commute}
          hint={remote ? 'remote — no commute' : undefined}
        />
        <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2.5">
          <dt className="text-sm font-medium text-slate-600">Estimated total</dt>
          <dd className="data text-2xl text-terracotta-700">
            {formatRent(total)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-slate-400">
        Rough estimates — utilities scale with size; commute assumes{' '}
        {commuteMode === 'drive' ? 'gas + wear per minute driven' : 'a monthly transit pass'}. Use
        as a ballpark, not a quote.
      </p>
    </section>
  );
}

function CostRow({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-sm text-slate-600">
        {label}
        {hint && <span className="ml-1.5 text-xs text-slate-400">({hint})</span>}
      </dt>
      <dd className="data text-sm text-slate-800">{formatRent(value)}</dd>
    </div>
  );
}

function Stepper({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-ink-700 text-slate-700 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}
