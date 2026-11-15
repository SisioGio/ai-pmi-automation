import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { createInterviewsApi } from "../src/interviews-api.js";
import { buildBrief, nextQuestion } from "../src/interview.js";
import type { LlmProvider } from "../src/llm/provider.js";
import { MemoryInterviewStore } from "../src/store.js";

/** LLM finto: restituisce le risposte in coda, e registra le chiamate. */
function fakeLlm(...replies: string[]): LlmProvider & { calls: number } {
  const q = [...replies];
  const llm = {
    calls: 0,
    async complete() {
      llm.calls++;
      const r = q.shift();
      if (r === undefined) throw new Error("nessuna risposta preparata");
      return r;
    },
  };
  return llm;
}

const event = (routeKey: string, opts: { sub?: string; id?: string; body?: unknown } = {}) =>
  ({
    routeKey,
    pathParameters: opts.id ? { id: opts.id } : undefined,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    requestContext: { authorizer: opts.sub ? { jwt: { claims: { sub: opts.sub } } } : undefined },
  }) as unknown as APIGatewayProxyEventV2;

const parse = (r: unknown) => JSON.parse((r as { body: string }).body);
const status = (r: unknown) => (r as { statusCode: number }).statusCode;

describe("nextQuestion / buildBrief", () => {
  it("legge la domanda anche se il modello aggiunge testo o blocchi json", async () => {
    const llm = fakeLlm('Ecco:\n```json\n{"question":"Quante ore?","done":false}\n```');
    expect(await nextQuestion(llm, [{ role: "user", text: "fatture" }])).toEqual({ question: "Quante ore?", done: false });
  });

  it("chiude senza chiamare il modello dopo 8 domande", async () => {
    const turns = Array.from({ length: 8 }, () => ({ role: "assistant" as const, text: "?" }));
    const llm = fakeLlm();
    expect((await nextQuestion(llm, turns)).done).toBe(true);
    expect(llm.calls).toBe(0);
  });

  it("normalizza il brief: categoria sconosciuta e numeri non validi", async () => {
    const llm = fakeLlm(JSON.stringify({
      summary: "s", categoryId: "inventata",
      processes: [{ name: "Fatture", steps: ["a", 3], tools: ["Excel"], hoursPerRun: "tanto", runsPerWeek: 5, painPoints: [] }],
      missingInfo: [],
    }));
    const b = await buildBrief(llm, [{ role: "user", text: "x" }]);
    expect(b.categoryId).toBe("da-classificare");
    expect(b.processes[0]).toMatchObject({ steps: ["a"], hoursPerRun: null, runsPerWeek: 5 });
  });
});

describe("interviews API", () => {
  const setup = (...replies: string[]) => {
    const store = new MemoryInterviewStore();
    const api = createInterviewsApi({ llm: fakeLlm(...replies), store });
    return { store, api };
  };

  it("richiede autenticazione", async () => {
    const { api } = setup();
    expect(status(await api(event("POST /interviews")))).toBe(401);
  });

  it("flusso completo: crea, risponde, chiude, genera il brief", async () => {
    const { api } = setup(
      '{"question":"Chi lo fa?","done":false}',
      '{"question":"Grazie","done":true}',
      JSON.stringify({ summary: "Fatture a mano", categoryId: "amministrazione-fatturazione", processes: [], missingInfo: [] }),
    );
    const created = parse(await api(event("POST /interviews", { sub: "u1" })));
    expect(created.id).toBeTruthy();

    const r1 = parse(await api(event("POST /interviews/{id}/answers", { sub: "u1", id: created.id, body: { text: "Le fatture" } })));
    expect(r1).toEqual({ question: "Chi lo fa?", done: false });
    const r2 = parse(await api(event("POST /interviews/{id}/answers", { sub: "u1", id: created.id, body: { text: "Io" } })));
    expect(r2.done).toBe(true);

    const closed = await api(event("POST /interviews/{id}/answers", { sub: "u1", id: created.id, body: { text: "altro" } }));
    expect(status(closed)).toBe(409);

    const brief = parse(await api(event("POST /interviews/{id}/finalize", { sub: "u1", id: created.id })));
    expect(brief.categoryId).toBe("amministrazione-fatturazione");
  });

  it("un altro utente riceve 404", async () => {
    const { api } = setup();
    const created = parse(await api(event("POST /interviews", { sub: "u1" })));
    expect(status(await api(event("GET /interviews/{id}", { sub: "u2", id: created.id })))).toBe(404);
  });

  it("rifiuta risposte vuote e non espone errori interni del modello", async () => {
    const { api } = setup("risposta senza json");
    const created = parse(await api(event("POST /interviews", { sub: "u1" })));
    expect(status(await api(event("POST /interviews/{id}/answers", { sub: "u1", id: created.id, body: { text: "  " } })))).toBe(400);
    const res = await api(event("POST /interviews/{id}/answers", { sub: "u1", id: created.id, body: { text: "ciao" } }));
    expect(status(res)).toBe(500);
    expect(parse(res)).toEqual({ error: "Errore interno" });
  });

  it("non genera il brief senza risposte", async () => {
    const { api } = setup();
    const created = parse(await api(event("POST /interviews", { sub: "u1" })));
    expect(status(await api(event("POST /interviews/{id}/finalize", { sub: "u1", id: created.id })))).toBe(409);
  });

  it("stima il risparmio dal brief, saltando i processi incompleti", async () => {
    const { api } = setup(
      '{"question":"Ok","done":false}',
      JSON.stringify({
        summary: "s", categoryId: "amministrazione-fatturazione", missingInfo: [],
        processes: [
          { name: "Fatture", steps: [], tools: [], hoursPerRun: 3, runsPerWeek: 1, painPoints: [] },
          { name: "Report", steps: [], tools: [], hoursPerRun: null, runsPerWeek: 1, painPoints: [] },
        ],
      }),
    );
    const { id } = parse(await api(event("POST /interviews", { sub: "u1" })));
    const est = (body: unknown, sub = "u1") => api(event("POST /interviews/{id}/estimate", { sub, id, body }));

    expect(status(await est({ hourlyCost: 25 }))).toBe(409); // brief non ancora generato

    await api(event("POST /interviews/{id}/answers", { sub: "u1", id, body: { text: "Le fatture" } }));
    await api(event("POST /interviews/{id}/finalize", { sub: "u1", id }));

    const res = parse(await est({ hourlyCost: 25, annualMaintenance: 600, projectPrice: 2500 }));
    expect(res.estimatedProcesses).toBe(1);
    expect(res.skippedProcesses).toBe(1);
    expect(res.totalGrossAnnualSavings).toBe(3600);
    expect(res.processes[0].savings).toMatchObject({ netAnnualSavings: 3000, paybackMonths: 10 });
    expect(res.processes[1]).toMatchObject({ savings: null, missing: ["ore per ripetizione"] });

    expect(status(await est({}))).toBe(400); // costo orario mancante
    expect(status(await est({ hourlyCost: -5 }))).toBe(400); // valore non valido
    expect(status(await est({ hourlyCost: 25 }, "u2"))).toBe(404); // altro utente
  });
});
