import { isCategoryId } from "./catalog.js";
import { extractJson, type ChatMessage, type LlmProvider } from "./llm/provider.js";
import { BRIEF_SYSTEM, INTERVIEW_SYSTEM, MAX_QUESTIONS } from "./prompts.js";

export interface Process {
  name: string;
  steps: string[];
  tools: string[];
  hoursPerRun: number | null;
  runsPerWeek: number | null;
  painPoints: string[];
}

export interface Brief {
  summary: string;
  categoryId: string;
  processes: Process[];
  missingInfo: string[];
}

export interface NextQuestion {
  question: string;
  done: boolean;
}

const countQuestions = (turns: ChatMessage[]) => turns.filter((t) => t.role === "assistant").length;

/** Chiede al modello la prossima domanda; chiude comunque dopo MAX_QUESTIONS domande. */
export async function nextQuestion(llm: LlmProvider, turns: ChatMessage[]): Promise<NextQuestion> {
  if (countQuestions(turns) >= MAX_QUESTIONS) {
    return { question: "Grazie, ho tutte le informazioni che servono.", done: true };
  }
  const raw = await llm.complete({ system: INTERVIEW_SYSTEM, messages: turns, maxTokens: 400 });
  const parsed = extractJson<Partial<NextQuestion>>(raw);
  if (typeof parsed.question !== "string" || !parsed.question.trim()) {
    throw new Error("Domanda mancante nella risposta del modello");
  }
  return { question: parsed.question.trim(), done: parsed.done === true };
}

const asNumberOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const asStrings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Produce e valida il brief strutturato dalla trascrizione. */
export async function buildBrief(llm: LlmProvider, turns: ChatMessage[]): Promise<Brief> {
  const transcript = turns
    .map((t) => `${t.role === "assistant" ? "Consulente" : "Titolare"}: ${t.text}`)
    .join("\n");
  const raw = await llm.complete({
    system: BRIEF_SYSTEM,
    messages: [{ role: "user", text: transcript }],
    maxTokens: 2000,
  });
  const p = extractJson<Record<string, unknown>>(raw);

  const processes: Process[] = (Array.isArray(p.processes) ? p.processes : []).map((x: Record<string, unknown>) => ({
    name: typeof x.name === "string" ? x.name : "Processo senza nome",
    steps: asStrings(x.steps),
    tools: asStrings(x.tools),
    hoursPerRun: asNumberOrNull(x.hoursPerRun),
    runsPerWeek: asNumberOrNull(x.runsPerWeek),
    painPoints: asStrings(x.painPoints),
  }));

  return {
    summary: typeof p.summary === "string" ? p.summary : "",
    // categoria non valida => il team la assegna a mano in revisione
    categoryId: isCategoryId(p.categoryId) ? p.categoryId : "da-classificare",
    processes,
    missingInfo: asStrings(p.missingInfo),
  };
}
