# Mappa Endpoint e Protezione JWT

> ⚠️ Questo file è un **puntatore**. La mappa statica precedente tendeva a
> diventare obsoleta (mancavano route reali). La fonte aggiornata è generata
> dall'indice in `skills/`:

```bash
python3 ../skills/tools/query.py endpoints            # tutti i servizi
python3 ../skills/tools/query.py endpoints payments   # un singolo servizio
```

L'output mostra per ogni route: metodo, path e livello di protezione
(`🌐 pubblico` / `🔐 jwt` / `🔒 admin` / `🔒 superuser`). Rigenera l'indice con
`python3 skills/tools/scan.py` dopo ogni modifica alle route.

## Regole globali (stabili)

- `401` = token assente o scaduto · `403` = token non valido o permessi mancanti.
- Header richiesto: `Authorization: Bearer <token>` (inoltrato da Nginx a tutti i servizi).
- `GET /health` è sempre pubblico in ogni servizio.
- In **auth** sono pubblici anche `POST /register`, `POST /login`, `POST /refresh-token`.
- Negli altri servizi la protezione è globale via `router.use(authenticateToken)`
  dopo `/health`; le route admin aggiungono `requireAdmin` / `requireSuperuser`.
