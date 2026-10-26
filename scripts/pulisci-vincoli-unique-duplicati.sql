-- Elimina i vincoli UNIQUE duplicati lasciati da sync({ alter: true }) quando
-- l'unicità era dichiarata sulla colonna (unique: true): Sequelize ne aggiungeva
-- uno nuovo (…_key1, …_key2, …) a ogni avvio del servizio.
-- Per ogni tabella e definizione identica tiene il vincolo dal nome più corto
-- (…_key, quello referenziato dagli indici dei modelli) e rimuove gli altri.
-- Idempotente; senza CASCADE: se un vincolo avesse dipendenze il DROP fallisce.
-- Uso: psql -U postgres -d <db> -f pulisci-vincoli-unique-duplicati.sql
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT conrelid::regclass AS tabella, conname
        FROM (
            SELECT c.conrelid, c.conname,
                   row_number() OVER (PARTITION BY c.conrelid, pg_get_constraintdef(c.oid)
                                      ORDER BY length(c.conname), c.conname) AS n
            FROM pg_constraint c
            JOIN pg_namespace s ON s.oid = c.connamespace
            WHERE s.nspname = 'public' AND c.contype = 'u'
        ) x
        WHERE n > 1
    LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabella, r.conname);
        RAISE NOTICE 'rimosso %.%', r.tabella, r.conname;
    END LOOP;
END $$;
