import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { Brief } from "./interview.js";
import type { ChatMessage } from "./llm/provider.js";

export interface InterviewRecord {
  id: string;
  owner: string;
  status: "open" | "done" | "finalized";
  turns: ChatMessage[];
  brief?: Brief;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewStore {
  get(id: string): Promise<InterviewRecord | undefined>;
  put(record: InterviewRecord): Promise<void>;
}

export class DynamoInterviewStore implements InterviewStore {
  private readonly doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  constructor(private readonly tableName: string) {}

  async get(id: string) {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: `INTERVIEW#${id}`, sk: "META" } }),
    );
    return res.Item?.record as InterviewRecord | undefined;
  }

  async put(record: InterviewRecord) {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: `INTERVIEW#${record.id}`, sk: "META", record },
      }),
    );
  }
}

export class MemoryInterviewStore implements InterviewStore {
  readonly items = new Map<string, InterviewRecord>();
  async get(id: string) {
    return this.items.get(id);
  }
  async put(record: InterviewRecord) {
    this.items.set(record.id, structuredClone(record));
  }
}
