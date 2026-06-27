# PROJECT CONTEXT — web-associazioni

> ⚠️ Questo file è un **puntatore**. La documentazione di progetto completa e
> sempre aggiornata vive nella cartella `skills/` alla **root del monorepo**
> (`../skills/`, generata/mantenuta dall'assistente AI).

## Dove trovare cosa

| Cosa cerchi | Dove |
|---|---|
| Architettura, microservizi, porte, dominio | `../skills/ARCHITECTURE.md` |
| Pattern backend (controller/model/route/auth) | `../skills/BACKEND_PATTERNS.md` |
| Pattern frontend (stili/componenti/fetch) | `../skills/FRONTEND_PATTERNS.md` |
| Route/modelli/handler aggiornati in tempo reale | `python3 ../skills/tools/query.py summary` |

Se la cartella `skills/` non è presente, rigenera l'indice con
`python3 skills/tools/scan.py`, oppure chiedi all'assistente AI di ricrearla.

## Promemoria minimo (per chi non ha `skills/`)

- **Backend**: microservizi Node/Express dietro Nginx · Sequelize · PostgreSQL
  (1 DB per servizio). Servizi: auth, users, payments, products, activities,
  documents, template. Prefisso esterno `/<servizio>/api`, container `<servizio>_ms:3000`.
- **Frontend**: SPA React + Vite · Context (`useSocieta`, `useAnno`) · `lucide-react`.
- **Auth**: JWT `Bearer` inoltrato da Nginx · `401` token assente/scaduto ·
  `403` non valido/permessi mancanti · `/health` pubblico.
- Mappa route↔protezione: `python3 ../skills/tools/query.py endpoints <servizio>`.
