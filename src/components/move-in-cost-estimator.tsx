import { useState } from 'react';
import {
  DEFAULT_MOVE_IN_INPUTS,
  estimateMoveInCost,
  upfrontMonthsOfIncome,
  type MoveInInputs,
} from '../lib/move-in-cost';
import { formatRent } from '../lib/format';

/**
 * "Move-in cost" section for a listing: the one-time upfront cash to sign the
 * lease (first month + deposit + broker fee + moving), recomputed live as the
 * user adjusts the assumptions. Sibling to <TrueCostCalculator/> — same look,
 * different question ("can I afford to move in?" vs "the monthly cost").
 */
export default function MoveInCostEstimator({
  rent,
  monthlyIncome,
}: {
  rent: number;
  /** Optional monthly take-home; when set, we show the total as months of income. */
  monthlyIncome?: number;
}) {
  const [inputs, setInputs] = useState<MoveInInputs>(DEFAULT_MOVE_IN_INPUTS);
  const breakdown = estimateMoveInCost(rent, inputs);
  const months = upfrontMonthsOfIncome(breakdown.total, monthlyIncome);

  return (
    <section className="rounded-2xl border border-slate-200 bg-ink p-5 shadow-sm">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Move-in cost</h2>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Security deposit (months)</span>
          <div className="flex items-center gap-2">
            <Stepper
              label="−"
              onClick={() =>
                setInputs((s) => ({
                  ...s,
                  securityDepositMonths: Math.max(0, s.securityDepositMonths - 1),
                }))
              }
              disabled={inputs.securityDepositMonths <= 0}
            />
            <span className="data w-4 text-center text-sm font-semibold text-slate-900">
              {inputs.securityDepositMonths}
            </span>
            <Stepper
              label="+"
              onClick={() =>
                setInputs((s) => ({
                  ...s,
                  securityDepositMonths: Math.min(3, s.securityDepositMonths + 1),
                }))
              }
              disabled={inputs.securityDepositMonths >= 3}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">Broker fee (% of yearly rent)</span>
          <div className="flex items-center gap-2">
            <Stepper
              label="−"
              onClick={() =>
                setInputs((s) => ({ ...s, brokerFeePct: Math.max(0, s.brokerFeePct - 5) }))
              }
              disabled={inputs.brokerFeePct <= 0}
            />
            <span className="data w-8 text-center text-sm font-semibold text-slate-900">
              {inputs.brokerFeePct}%
            </span>
            <Stepper
              label="+"
              onClick={() =>
                setInputs((s) => ({ ...s, brokerFeePct: Math.min(15, s.brokerFeePct + 5) }))
              }
              disabled={inputs.brokerFeePct >= 15}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={inputs.requireLastMonth}
            onChange={(e) => setInputs((s) => ({ ...s, requireLastMonth: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 accent-brand-600"
          />
          Last month's rent up front
        </label>
      </div>

      {/* Breakdown */}
      <dl className="mt-4 space-y-1.5">
        <CostRow label="First month's rent" value={breakdown.firstMonth} />
        {breakdown.lastMonth > 0 && (
          <CostRow label="Last month's rent" value={breakdown.lastMonth} />
        )}
        <CostRow
          label="Security deposit"
          value={breakdown.securityDeposit}
          hint={
            inputs.securityDepositMonths > 0
              ? `${inputs.securityDepositMonths}× rent`
              : 'none'
          }
        />
        <CostRow
          label="Broker fee (est.)"
          value={breakdown.brokerFee}
          hint={inputs.brokerFeePct > 0 ? `${inputs.brokerFeePct}% of yearly rent` : 'no-fee'}
        />
        <CostRow label="Application fee" value={breakdown.applicationFee} />
        <CostRow label="Moving cost (est.)" value={breakdown.movingCost} />
        <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-2.5">
          <dt className="text-sm font-medium text-slate-600">Upfront total</dt>
          <dd className="data font-serif text-2xl font-semibold text-terracotta-700">
            {formatRent(breakdown.total).replace('/mo', '')}
          </dd>
        </div>
      </dl>

      {months != null && (
        <p className="mt-3 inline-flex rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700">
          That's about {months} month{months === 1 ? '' : 's'} of your take-home income up front.
        </p>
      )}

      <p className="mt-3 text-xs text-slate-400">
        Rough estimate of the cash you'd need to sign — not a quote. Actual deposits, fees, and
        broker terms vary by landlord and city.
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
      <dd className="data text-sm text-slate-800">{formatRent(value).replace('/mo', '')}</dd>
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
