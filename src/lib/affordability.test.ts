import { describe, it, expect } from 'vitest';
import { affordability } from './affordability';

describe('affordability', () => {
  it('is off unless the user supplies an income', () => {
    expect(affordability(3000, undefined)).toBeNull();
    expect(affordability(3000, 0)).toBeNull();
    expect(affordability(3000, -100)).toBeNull();
  });

  it('reports rent as a whole-number share of income', () => {
    expect(affordability(3000, 10000)!.pct).toBe(30);
    expect(affordability(2500, 8000)!.pct).toBe(31); // 31.25 rounds to 31
  });

  it('calls the 30% rule comfortable, inclusive of the boundary', () => {
    const at30 = affordability(3000, 10000)!;
    expect(at30.band).toBe('comfortable');
    expect(at30.withinRule).toBe(true);
  });

  it('bands 31–40% as a stretch and above 40% as over', () => {
    expect(affordability(3500, 10000)!.band).toBe('stretch');
    expect(affordability(4000, 10000)!.band).toBe('stretch'); // 40% is the boundary
    expect(affordability(4100, 10000)!.band).toBe('over');
  });

  it('marks everything above the rule as outside it', () => {
    for (const rent of [3100, 4000, 6000]) {
      expect(affordability(rent, 10000)!.withinRule).toBe(false);
    }
  });

  it('bands never go backwards as rent climbs', () => {
    const order = { comfortable: 0, stretch: 1, over: 2 } as const;
    let previous = -1;
    for (let rent = 0; rent <= 10000; rent += 100) {
      const rank = order[affordability(rent, 10000)!.band];
      expect(rank).toBeGreaterThanOrEqual(previous);
      previous = rank;
    }
  });

  it('labels every band with the percentage', () => {
    for (const rent of [1000, 3500, 6000]) {
      const info = affordability(rent, 10000)!;
      expect(info.label).toBe(`${info.pct}% of income`);
      expect(info.className.length).toBeGreaterThan(0);
    }
  });
});
