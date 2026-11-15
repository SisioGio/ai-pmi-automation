# AI PMI Automation

Piattaforma di intake e analisi per scoprire il potenziale di automazione nelle PMI italiane, più il team e i tool per realizzarlo e gestirlo.

Il piano completo è in [docs/business-plan.md](docs/business-plan.md).

## Struttura

| Percorso | Contenuto |
| --- | --- |
| `docs/` | Business plan, decisioni di architettura, note di ricerca |
| `catalog/` | Catalogo di categorie ed esempi (dati, non codice) |
| `prompts/` | Prompt per intervista, mappa dei processi e classificazione |
| `apps/` | Applicazioni (web app di intake, pannello interno) |
| `services/` | Servizi backend (analisi, calcolo risparmio, report PDF) |

## MVP

Vedi [docs/mvp-backlog.md](docs/mvp-backlog.md). Obiettivo: i titolari pagano per un'analisi chiara e accettano un progetto basato su di essa.

## Stato

Stack: AWS (CDK TypeScript, Cognito, API Gateway + Lambda, DynamoDB, S3, Bedrock). Vedi [docs/decisions/0001-stack.md](docs/decisions/0001-stack.md).

## Sviluppo

```bash
npm install
npm test            # test del calcolo del risparmio
npm run typecheck
cd infra && npx cdk synth -c stage=dev
```

Deploy: workflow GitHub Actions `Deploy` (manuale). Richiede il secret `AWS_DEPLOY_ROLE_ARN` (ruolo IAM con trust OIDC verso questo repo) in ogni GitHub Environment (`dev`, `prod`).
