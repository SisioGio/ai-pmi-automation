# Contesto del progetto

Piattaforma per PMI italiane: intervista guidata, mappa dei processi, stima del risparmio, report e catalogo di esempi. Piano completo in `docs/business-plan.md`. Stack in `docs/decisions/0001-stack.md` (solo AWS, CDK TypeScript, regione UE).

## Regole
- Lingua dei testi per i clienti e dei commenti di dominio: italiano.
- Tutte le soluzioni proposte sono progettate sul cliente. Non proporre né nominare "strumenti esistenti" come opzione. Le opzioni sono: non fare nulla, soluzione essenziale, soluzione completa (tutte su misura).
- Passi piccoli e visibili: ogni passo ha una pagina di anteprima in `apps/preview/` con un URL (indice in `apps/preview/README.md`).
- Non inventare dati del cliente: i numeri mancanti restano `null` e si chiedono. Cifre di esempio vanno dichiarate come esempi.
- Dati personali e riservati: dati minimi verso i provider LLM, vedi il piano.

## Comandi
```bash
npm install
npm test                 # test API (savings, interviste, stima)
npm run typecheck
cd infra && npx cdk synth -c stage=dev
```

## Stato
- Fatto: API `/savings`, `/interviews` (+ answers, finalize, estimate), infrastruttura CDK, CI, template ruolo OIDC (`infra/bootstrap/github-oidc.yaml`), pagine di anteprima 1-5.
- Non ancora fatto: deploy reale su AWS (vedi checklist, pagina 5), prova su Bedrock reale, interviste vocali (Transcribe), frontend collegato all'API, generazione PDF, pannello interno di revisione.
- Prossimo passo: dopo il deploy, collegare la pagina di intervista (`apps/preview/02-interview.html`) all'API reale con un interruttore simulato/live.
