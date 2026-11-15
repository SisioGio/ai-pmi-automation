import { describe, expect, it } from "vitest";
import { calculateSavings } from "../src/savings.js";

describe("calculateSavings", () => {
  it("riproduce l'esempio del piano: 3 h/sett, 48 sett, 25 €/h = 3.600 €", () => {
    const r = calculateSavings({
      hoursPerRun: 3, runsPerWeek: 1, weeksPerYear: 48, hourlyCost: 25, annualMaintenance: 0,
    });
    expect(r.grossAnnualSavings).toBe(3600);
    expect(r.netAnnualSavings).toBe(3600);
  });

  it("sottrae la manutenzione e calcola il tempo di recupero", () => {
    const r = calculateSavings({
      hoursPerRun: 3, runsPerWeek: 1, weeksPerYear: 48, hourlyCost: 25,
      annualMaintenance: 600, projectPrice: 3000,
    });
    expect(r.netAnnualSavings).toBe(3000);
    expect(r.paybackMonths).toBe(12);
  });

  it("non indica un recupero se il risparmio netto non è positivo", () => {
    const r = calculateSavings({
      hoursPerRun: 1, runsPerWeek: 1, weeksPerYear: 10, hourlyCost: 10,
      annualMaintenance: 500, projectPrice: 1000,
    });
    expect(r.netAnnualSavings).toBeLessThan(0);
    expect(r.paybackMonths).toBeNull();
  });

  it("rifiuta valori negativi o non numerici", () => {
    expect(() => calculateSavings({
      hoursPerRun: -1, runsPerWeek: 1, weeksPerYear: 1, hourlyCost: 1, annualMaintenance: 0,
    })).toThrow(RangeError);
  });
});
