/** Interfaccia minima per i provider LLM: permette di cambiarli per flusso (vedi business plan). */
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface LlmProvider {
  complete(args: { system: string; messages: ChatMessage[]; maxTokens?: number }): Promise<string>;
}

/** Estrae il primo oggetto JSON da una risposta che può contenere testo o blocchi ```json. */
export function extractJson<T>(raw: string): T {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Risposta del modello senza JSON");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
