import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { ChatMessage, LlmProvider } from "./provider.js";

/** Provider Amazon Bedrock (API Converse, uguale per tutti i modelli supportati). */
export class BedrockProvider implements LlmProvider {
  private readonly client: BedrockRuntimeClient;

  constructor(private readonly modelId: string, region?: string) {
    this.client = new BedrockRuntimeClient(region ? { region } : {});
  }

  async complete(args: { system: string; messages: ChatMessage[]; maxTokens?: number }): Promise<string> {
    const res = await this.client.send(
      new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: args.system }],
        messages: args.messages.map((m) => ({ role: m.role, content: [{ text: m.text }] })),
        inferenceConfig: { maxTokens: args.maxTokens ?? 1500, temperature: 0.2 },
      }),
    );
    const text = res.output?.message?.content?.map((c) => c.text ?? "").join("") ?? "";
    if (!text) throw new Error("Risposta vuota da Bedrock");
    return text;
  }
}
