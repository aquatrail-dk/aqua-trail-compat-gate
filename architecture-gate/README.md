# Aqua Trail Architecture Gate v0.1

Ambiente tecnico isolato per verificare la nuova architettura prima di ristrutturare V0.9.

## Obiettivo
Verificare la stessa UI con due provider:
- DEMO: dati in memoria, nessuna rete.
- LIVE: GitHub Pages -> Google Apps Script -> Google Sheets.

## Percorso minimo
1. login
2. elenco eventi
3. apertura evento
4. elenco binomi event-scoped
5. scrittura di una probe
6. logout

## Vincoli
- Nessun dato reale.
- Nessun accesso al database V0.9.
- Nessun Google OAuth, Firebase, Cloud Run o servizio esterno.
- Nessun localStorage/IndexedDB come fonte dati ufficiale.
- Sessione LIVE server-side via Apps Script CacheService.
- Ruoli testati: ADMIN e GIUDICE con event_id.

## Database test
AQUA_TRAIL_ARCH_GATE_DB
Spreadsheet ID: 1XOqZaik3sK6tg-0bxSypkVmAgFVGGQISdr6uNndhM_0

## Stato
Il frontend DEMO è immediatamente eseguibile.
Per LIVE occorre distribuire apps-script/Code.gs in un progetto Apps Script separato e poi inserire l'URL del deployment in config.js.
