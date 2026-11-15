# 0001 - Scelta dello stack

Stato: **accettato** (iniziale, rivedibile dopo i primi 5 + 5 analisi)

## Decisione
Solo risorse AWS, in regione UE (`eu-central-1`, alternativa `eu-south-1`), infrastruttura come codice con **AWS CDK (TypeScript)**, deploy da GitHub Actions con OIDC (nessuna chiave AWS salvata in GitHub).

| Ambito | Scelta |
| --- | --- |
| Auth | Amazon Cognito (titolari e team interno) |
| API | API Gateway HTTP + Lambda (Node.js 22, TypeScript) |
| Dati | DynamoDB (pk/sk), cifrato, point-in-time recovery |
| File | S3 privato, cifrato, versionato (audio, PDF) |
| LLM | Amazon Bedrock (provider intercambiabili) - da collegare |
| Trascrizione | Amazon Transcribe - da collegare |
| Modelli locali / dati sensibili | SageMaker o EC2 nell'account del cliente - da valutare |
| Frontend | S3 + CloudFront - da aggiungere |

## Conseguenze
- Ogni cliente può avere il proprio stack nel proprio account AWS (`-c stage=<cliente>`), coerente con "tutto gira sull'infrastruttura del cliente".
- La disponibilità dei modelli Bedrock varia per regione: verificare prima di scegliere la regione.
- Verifica legale (GDPR, AI Act) resta da fare per ogni progetto.
