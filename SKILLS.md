# PROJECT CONTEXT — web-associazioni

> Aggiorna questo file ad ogni modifica architetturale, nuova libreria o pattern rilevante.

## Stack
- **Backend**: Node.js/Express microservizi dietro Nginx gateway · ORM Sequelize · DB PostgreSQL
- **Frontend**: React SPA · Context API (`useSocieta`, `useAnno`) · `lucide-react` · CSS modules + classi globali (`md-input`, `md-select`, `btn-contained`, `btn-icon-small`)

## Microservizi & Prefissi API

| Servizio | Prefisso esterno | Container interno |
|---|---|---|
| auth | `/auth/api` | `auth_ms:3000` |
| users | `/users/api` | `users_ms:3000` |
| payments | `/payments/api` | `payments_ms:3000` |
| products | `/products/api` | `products_ms:3000` |
| activities | `/activities/api` | `activities_ms:3000` |
| documents | `/documents/api` | `documents_ms:3000` |
| template | `/template/api` | `template_ms:3000` |

## Auth / Sicurezza
- JWT come `Bearer <token>` nell'header `Authorization`, inoltrato da Nginx a tutti i servizi
- `401` = token assente · `403` = token non valido
- Chiamate inter-servizio passano l'header `Authorization` del chiamante originale (vedi `societaController.js`)
- Endpoint `/health` sempre pubblici

## Pattern Backend (non ovvi)
- Controller: `exports.fn = async (req, res) => {}` — nessuna classe
- Errori: `{ error: 'msg' }` con status HTTP corretto, mai stack trace al client
- Chiamate inter-servizio: URL interni Docker (`http://users_ms:3000/...`), non via Nginx

## Pattern Frontend (non ovvi)
- Fetch: path relativi (`/payments/api/...`) proxyati da Vite all'Nginx locale; JWT aggiunto manualmente nell'header
- Librerie pesanti (es. SheetJS): lazy loading da CDN a runtime (es. `loadXlsxFromCdn`), NON importate come dipendenze npm
- Modali: stato boolean nel padre (`isOpen`/`showModal`) + overlay con `onClose`

## Logica di Dominio (non derivabile dal codice)
- Alla creazione di una società vengono inizializzati automaticamente: moduli default (documents), conto CASSA (payments), gruppi contabili per tipo:
  - `APS` → `POST /payments/api/gruppi/init-aps`
  - `ASD` → `POST /payments/api/gruppi/init-asd`
- I gruppi contabili hanno struttura codice gerarchica: radice (`E`/`U` per APS, `E`/`U` per ASD), sottogruppi (`EA1`, `E1`, ecc.)

## File di riferimento
- `AUTH_ENDPOINT_MAP.md` — mappatura completa route → microservizio (aggiornare ad ogni nuova route)
- `docker/docker-compose.yml` — config produzione/server (non modificare per uso locale)
- `docker/docker-compose.local.yml` — config locale, gitignored (porte 4001–4007, nginx 8081)
- `create_ms.py` — scaffolding nuovo microservizio da template
