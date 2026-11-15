/**
 * Calcolo del risparmio (vedi docs/business-plan.md, "Calcolo del risparmio").
 * Risparmio annuo = h * n * s * c - m
 */
export interface SavingsInput {
  /** h: ore per ripetizione */
  hoursPerRun: number;
  /** n: ripetizioni a settimana */
  runsPerWeek: number;
  /** s: settimane lavorate all'anno */
  weeksPerYear: number;
  /** c: costo orario in euro */
  hourlyCost: number;
  /** m: costo annuo di manutenzione della soluzione in euro */
  annualMaintenance: number;
  /** prezzo del progetto in euro, per il tempo di recupero (opzionale) */
  projectPrice?: number;
}

export interface SavingsResult {
  grossAnnualSavings: number;
  netAnnualSavings: number;
  /** mesi per recuperare l'investimento; null se non recuperabile o prezzo assente */
  paybackMonths: number | null;
}

function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} deve essere un numero >= 0`);
  }
}

export function calculateSavings(input: SavingsInput): SavingsResult {
  const { hoursPerRun, runsPerWeek, weeksPerYear, hourlyCost, annualMaintenance, projectPrice } = input;
  assertNonNegative("hoursPerRun", hoursPerRun);
  assertNonNegative("runsPerWeek", runsPerWeek);
  assertNonNegative("weeksPerYear", weeksPerYear);
  assertNonNegative("hourlyCost", hourlyCost);
  assertNonNegative("annualMaintenance", annualMaintenance);
  if (projectPrice !== undefined) assertNonNegative("projectPrice", projectPrice);

  const gross = hoursPerRun * runsPerWeek * weeksPerYear * hourlyCost;
  const net = gross - annualMaintenance;
  const paybackMonths =
    projectPrice !== undefined && net > 0 ? Math.round((projectPrice / net) * 12 * 10) / 10 : null;

  return { grossAnnualSavings: gross, netAnnualSavings: net, paybackMonths };
}
