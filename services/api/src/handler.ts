import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { calculateSavings, type SavingsInput } from "./savings.js";

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export async function calculateSavingsHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const input = JSON.parse(event.body ?? "{}") as SavingsInput;
    return json(200, calculateSavings(input));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Richiesta non valida";
    return json(400, { error: message });
  }
}

export async function healthHandler(): Promise<APIGatewayProxyResultV2> {
  return json(200, { status: "ok" });
}
