import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";

export interface PlatformStackProps extends cdk.StackProps {
  stage: string;
  /** ID del modello o inference profile Bedrock per l'intervista. Verificare la disponibilità nella regione. */
  modelId: string;
}

/**
 * Stack iniziale dell'MVP: autenticazione, dati, API.
 * Tutto in una regione UE. Bedrock/Transcribe vengono collegati nei passi successivi.
 */
export class PlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PlatformStackProps) {
    super(scope, id, props);
    const isProd = props.stage === "prod";
    const removal = isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // --- Auth: titolari (cliente) e team interno ---
    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: { minLength: 12 },
      removalPolicy: removal,
    });
    const userPoolClient = userPool.addClient("WebClient", {
      authFlows: { userSrp: true },
      generateSecret: false,
    });

    // --- Dati: analisi, interviste, catalogo ---
    const table = new dynamodb.Table(this, "Data", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: removal,
    });

    // --- File: audio delle interviste e report PDF ---
    const files = new s3.Bucket(this, "Files", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: removal,
      autoDeleteObjects: !isProd,
    });

    // --- API ---
    const apiEntry = path.join(__dirname, "../../services/api/src/handler.ts");
    const fnDefaults = {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: apiEntry,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: { TABLE_NAME: table.tableName, FILES_BUCKET: files.bucketName },
      projectRoot: path.join(__dirname, "../.."),
      depsLockFilePath: path.join(__dirname, "../../package-lock.json"),
      bundling: { minify: true, target: "node22" },
    };
    const healthFn = new NodejsFunction(this, "HealthFn", { ...fnDefaults, handler: "healthHandler" });
    const savingsFn = new NodejsFunction(this, "SavingsFn", { ...fnDefaults, handler: "calculateSavingsHandler" });
    table.grantReadWriteData(savingsFn);

    // Interviste: Bedrock + DynamoDB. Timeout più lungo per le chiamate al modello.
    const interviewsFn = new NodejsFunction(this, "InterviewsFn", {
      ...fnDefaults,
      handler: "interviewsHandler",
      timeout: cdk.Duration.seconds(30),
      environment: { ...fnDefaults.environment, MODEL_ID: props.modelId },
    });
    table.grantReadWriteData(interviewsFn);
    // Solo questa funzione può invocare i modelli. Gli inference profile UE instradano
    // tra più regioni UE, quindi la risorsa non può essere limitata a una sola regione.
    interviewsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          "arn:aws:bedrock:*::foundation-model/*",
          `arn:aws:bedrock:*:${this.account}:inference-profile/*`,
        ],
      }),
    );

    const api = new apigw.HttpApi(this, "Api", {
      corsPreflight: {
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST, apigw.CorsHttpMethod.OPTIONS],
        allowHeaders: ["authorization", "content-type"],
        allowOrigins: ["*"], // da restringere al dominio del frontend
      },
    });
    const authorizer = new HttpUserPoolAuthorizer("Authorizer", userPool, {
      userPoolClients: [userPoolClient],
    });
    api.addRoutes({
      path: "/health",
      methods: [apigw.HttpMethod.GET],
      integration: new HttpLambdaIntegration("HealthInt", healthFn),
    });
    api.addRoutes({
      path: "/savings",
      methods: [apigw.HttpMethod.POST],
      integration: new HttpLambdaIntegration("SavingsInt", savingsFn),
      authorizer,
    });

    const interviewsInt = new HttpLambdaIntegration("InterviewsInt", interviewsFn);
    for (const [method, route] of [
      [apigw.HttpMethod.POST, "/interviews"],
      [apigw.HttpMethod.GET, "/interviews/{id}"],
      [apigw.HttpMethod.POST, "/interviews/{id}/answers"],
      [apigw.HttpMethod.POST, "/interviews/{id}/finalize"],
      [apigw.HttpMethod.POST, "/interviews/{id}/estimate"],
    ] as const) {
      api.addRoutes({ path: route, methods: [method], integration: interviewsInt, authorizer });
    }

    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new cdk.CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
  }
}
