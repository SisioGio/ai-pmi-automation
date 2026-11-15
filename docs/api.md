# API

Tutte le rotte tranne `/health` richiedono un token Cognito (`Authorization: Bearer <idToken>`).

| Rotta | Cosa fa |
| --- | --- |
| `GET /health` | Controllo di stato |
| `POST /savings` | Calcolo del risparmio: `{hoursPerRun, runsPerWeek, weeksPerYear, hourlyCost, annualMaintenance, projectPrice?}` |
| `POST /interviews` | Avvia un'intervista, restituisce `{id, question, done}` |
| `POST /interviews/{id}/answers` | Invia `{text}`, restituisce la domanda successiva `{question, done}` |
| `POST /interviews/{id}/finalize` | Genera il brief strutturato (processi, strumenti, ore, categoria del catalogo) |
| `GET /interviews/{id}` | Stato e trascrizione. Solo il proprietario, altrimenti 404 |

## Note
- L'intervista chiude dopo al massimo 8 domande, o prima se il modello ha abbastanza informazioni.
- Il brief usa solo ciò che è stato detto: i dati mancanti sono `null` e finiscono in `missingInfo`. Se la categoria non è nel catalogo, vale `da-classificare` e la assegna il team in revisione.
- Il modello Bedrock si cambia con `cdk deploy -c modelId=<id>`. Verificare la disponibilità nella regione scelta.
- I prompt sono in `services/api/src/prompts.ts`.
