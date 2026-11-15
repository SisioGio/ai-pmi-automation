import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { estimateFromBrief, type EstimateParams } from "./estimate.js";
import { buildBrief, nextQuestion } from "./interview.js";
import type { LlmProvider } from "./llm/provider.js";
import { OPENING_QUESTION } from "./prompts.js";
import type { InterviewStore } from "./store.js";

const MAX_ANSWER_CHARS = 4000;

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

type Claims = { sub?: string };
const ownerOf = (e: APIGatewayProxyEventV2): string | undefined =>
  (e as { requestContext: { authorizer?: { jwt?: { claims?: Claims } } } }).requestContext.authorizer?.jwt?.claims?.sub;

/** Router per le rotte /interviews. Dipendenze iniettate per poterlo testare senza AWS. */
export function createInterviewsApi(deps: { llm: LlmProvider; store: InterviewStore; now?: () => Date }) {
  const { llm, store } = deps;
  const now = () => (deps.now ?? (() => new Date()))().toISOString();

  return async function handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const owner = ownerOf(event);
    if (!owner) return json(401, { error: "Non autenticato" });

    try {
      if (event.routeKey === "POST /interviews") {
        const id = randomUUID();
        const ts = now();
        await store.put({
          id, owner, status: "open", createdAt: ts, updatedAt: ts,
          turns: [{ role: "assistant", text: OPENING_QUESTION }],
        });
        return json(201, { id, question: OPENING_QUESTION, done: false });
      }

      const id = event.pathParameters?.id;
      if (!id) return json(400, { error: "id mancante" });
      const record = await store.get(id);
      // 404 anche se appartiene a un altro utente: non rivelare l'esistenza
      if (!record || record.owner !== owner) return json(404, { error: "Intervista non trovata" });

      if (event.routeKey === "GET /interviews/{id}") {
        return json(200, record);
      }

      if (event.routeKey === "POST /interviews/{id}/answers") {
        if (record.status !== "open") return json(409, { error: "Intervista già chiusa" });
        const { text } = JSON.parse(event.body ?? "{}") as { text?: unknown };
        if (typeof text !== "string" || !text.trim()) return json(400, { error: "Risposta vuota" });
        if (text.length > MAX_ANSWER_CHARS) return json(400, { error: "Risposta troppo lunga" });

        record.turns.push({ role: "user", text: text.trim() });
        const next = await nextQuestion(llm, record.turns);
        record.turns.push({ role: "assistant", text: next.question });
        if (next.done) record.status = "done";
        record.updatedAt = now();
        await store.put(record);
        return json(200, next);
      }

      if (event.routeKey === "POST /interviews/{id}/finalize") {
        if (record.turns.filter((t) => t.role === "user").length === 0) {
          return json(409, { error: "Nessuna risposta da analizzare" });
        }
        record.brief = await buildBrief(llm, record.turns);
        record.status = "finalized";
        record.updatedAt = now();
        await store.put(record);
        return json(200, record.brief);
      }

      if (event.routeKey === "POST /interviews/{id}/estimate") {
        if (!record.brief) return json(409, { error: "Genera prima il brief" });
        const params = JSON.parse(event.body ?? "{}") as Partial<EstimateParams>;
        if (typeof params.hourlyCost !== "number") return json(400, { error: "hourlyCost obbligatorio" });
        return json(200, estimateFromBrief(record.brief, params as EstimateParams));
      }

      return json(404, { error: "Rotta non trovata" });
    } catch (err) {
      console.error("interviews error", err);
      // Il messaggio interno (es. risposta del modello) non va al client
      if (err instanceof RangeError) return json(400, { error: err.message }); // valori numerici non validi
      const isBadJson = err instanceof SyntaxError && /\/(answers|estimate)$/.test(event.routeKey);
      return isBadJson ? json(400, { error: "Corpo non valido" }) : json(500, { error: "Errore interno" });
    }
  };
}
