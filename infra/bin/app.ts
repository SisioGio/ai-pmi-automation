import * as cdk from "aws-cdk-lib";
import { PlatformStack } from "../lib/platform-stack";

const app = new cdk.App();
const stage = app.node.tryGetContext("stage") ?? "dev";

new PlatformStack(app, `AiPmi-${stage}`, {
  stage,
  // Dati in UE (vedi docs/business-plan.md). Cambiabile con -c region=eu-south-1
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: app.node.tryGetContext("region") ?? "eu-central-1",
  },
});
