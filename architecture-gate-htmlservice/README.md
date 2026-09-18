# Aqua Trail HTMLService Gate

Secondo gate tecnico dopo il fallimento intermittente del trasporto esterno GitHub Pages -> Apps Script ContentService.

Obiettivo: verificare la stessa catena applicativa senza ContentService, usando Apps Script HtmlService + google.script.run.

Database di test: AQUA_TRAIL_ARCH_GATE_DB

Gate precedente:
DIRECT_CONTENTSERVICE_GATE = FAIL_INTERMITTENT_REDIRECT_404

Nota di sicurezza:
le password di test devono esistere solo nelle Script Properties del progetto Apps Script e non nel repository.
