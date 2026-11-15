import type { Brief } from "./interview.js";
import { calculateSavings, type SavingsResult } from "./savings.js";

export interface EstimateParams {
  /** costo orario in euro: lo fornisce il cliente, non si indovina */
  hourlyCost: number;
  /** settimane lavorate all'anno (default 48, come nell'esempio del piano) */
  weeksPerYear?: number;
  annualMaintenance?: number;
  projectPrice?: number;
}

export interface ProcessEstimate {
  name: string;
  /** null quando mancano ore o frequenza: va chiesto al cliente */
  savings: SavingsResult | null;
  missing: string[];
}

export interface Estimate {
  processes: ProcessEstimate[];
  /** somma dei risparmi lordi dei soli processi stimati */
  totalGrossAnnualSavings: number;
  estimatedProcesses: number;
  skippedProcesses: number;
}

/** Applica la formula del piano ai processi del brief; i processi incompleti non si stimano. */
export function estimateFromBrief(brief: Brief, params: EstimateParams): Estimate {
  const weeksPerYear = params.weeksPerYear ?? 48;
  const annualMaintenance = params.annualMaintenance ?? 0;

  const processes = brief.processes.map<ProcessEstimate>((p) => {
    const missing: string[] = [];
    if (p.hoursPerRun === null) missing.push("ore per ripetizione");
    if (p.runsPerWeek === null) missing.push("ripetizioni a settimana");
    if (missing.length) return { name: p.name, savings: null, missing };
    return {
      name: p.name,
      missing,
      savings: calculateSavings({
        hoursPerRun: p.hoursPerRun!,
        runsPerWeek: p.runsPerWeek!,
        weeksPerYear,
        hourlyCost: params.hourlyCost,
        annualMaintenance,
        projectPrice: params.projectPrice,
      }),
    };
  });

  const done = processes.filter((p) => p.savings);
  return {
    processes,
    totalGrossAnnualSavings: done.reduce((sum, p) => sum + p.savings!.grossAnnualSavings, 0),
    estimatedProcesses: done.length,
    skippedProcesses: processes.length - done.length,
  };
}
