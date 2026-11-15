import * as cdk from "aws-cdk-lib";
import { PlatformStack } from "../lib/platform-stack";

const app = new cdk.App();
const stage = app.node.tryGetContext("stage") ?? "dev";

new PlatformStack(app, `AiPmi-${stage}`, {
  stage,
  // Inference profile UE di Bedrock. Da verificare/aggiornare: -c modelId=<id>
  modelId: app.node.tryGetContext("modelId") ?? "eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
  // Dati in UE (vedi docs/business-plan.md). Cambiabile con -c region=eu-south-1
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: app.node.tryGetContext("region") ?? "eu-central-1",
  },
});
