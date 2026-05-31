# Mappa Endpoint e Protezione JWT

Stato aggiornato dopo la patch di enforcement JWT sui microservizi.

## Regole globali

- `401` = token assente
- `403` = token non valido o scaduto
- Header richiesto: `Authorization: Bearer <token>`
- Endpoints `health` restano pubblici

## Gateway Nginx

- Inoltra `Authorization` verso tutti i servizi backend.
- File: `backend/docker/nginx.conf`

## Auth Service (`/auth/api`)

### Pubblici

- `GET /health`
- `POST /register`
- `POST /login`
- `POST /refresh-token`

### Protetti

- `GET /me`
- `PUT /me`
- `PUT /password`
- `GET /admin/users`
- `POST /admin/users`
- `PUT /admin/users/:id`
- `PATCH /admin/users/:id/toggle-attivo`
- `DELETE /admin/users/:id`
- `POST /admin/users/:id/impersonate`
- `GET /admin/users/:id/features`
- `PUT /admin/users/:id/features`
- `POST /socio-access`
- `DELETE /socio-access/:socio_ref_id`
- `POST /socio-access/:socio_ref_id/reset-password`

## Users Service (`/users/api`)

### Pubblici

- `GET /health`

### Protetti

- Tutte le route sotto `/soci`
- Tutte le route sotto `/societa`

## Documents Service (`/documents/api`)

### Pubblici

- `GET /health`

### Protetti

- Tutte le route sotto `/moduli`

## Products Service (`/products/api`)

### Pubblici

- `GET /health`

### Protetti

- Tutte le route prodotto (`/` e `/:id`)

## Payments Service (`/payments/api`)

### Pubblici

- `GET /health`

### Protetti

- Tutte le route conti
- Tutte le route gruppi
- Tutte le route fornitori
- Tutte le route pagamenti (`/`, `/bulk`, `/import-voci`, `/:id`, `/:id/annulla`, `/next-numero`)

## Activities Service (`/activities/api`)

### Pubblici

- `GET /health`

### Protetti

- Tutte le route sotto `/strutture`
- Tutte le route sotto `/aree`
- Tutte le route sotto `/staff`
- Tutte le route sotto `/attivita`
- Tutte le route sotto `/corsi`

## Template Service (`/template/api`)

### Pubblici

- `GET /health`

### Protetti

- Nessuna route business presente al momento.
