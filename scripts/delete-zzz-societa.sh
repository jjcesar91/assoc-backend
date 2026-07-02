#!/usr/bin/env bash
#
# delete-zzz-societa.sh
# -----------------------------------------------------------------------------
# Cancella in modo definitivo un elenco di società e TUTTI i dati collegati,
# distribuiti sui 5 database dei microservizi (users, payments, activities,
# documents, products).
#
# NON esiste cascade tra i database, quindi ogni DB va ripulito esplicitamente.
# Attenzione: socios.societa_id è ON DELETE SET NULL, per questo i soci vanno
# cancellati PRIMA della società (altrimenti resterebbero orfani, non cancellati).
#
# USO (da eseguire sul server di PRODUZIONE, dove girano i container):
#   ./delete-zzz-societa.sh            # modalità normale (backup + conferma + delete)
#   DRY_RUN=1 ./delete-zzz-societa.sh  # solo anteprima conteggi, NON cancella nulla
# -----------------------------------------------------------------------------
set -euo pipefail

# --- ID delle società ZZZ_ da cancellare (id 1 e 2 = demo, ESCLUSI) ----------
IDS="3,4,5,6,7,8,9,10,11,14,15,16,18,19,21,22"

# --- Credenziali / container (default docker-compose) ------------------------
PGUSER="${PGUSER:-postgres}"
PGPASSWORD_VAL="${PGPASSWORD:-postgres}"
DRY_RUN="${DRY_RUN:-0}"

BACKUP_DIR="./backup-zzz-$(date +%Y%m%d-%H%M%S)"

# container_name -> nome_db (nel docker-compose coincidono)
# NB: users_db per PRIMO (il cleanup di auth_db si basa sugli id superstiti qui).
DBS=(users_db payments_db activities_db documents_db products_db)
# Tutti i DB di cui fare backup (auth_db incluso: viene ripulito a fine script).
BACKUP_DBS=("${DBS[@]}" auth_db)

# psql helper: docker exec sul container del DB
# $1 = container/db name ; eventuali argomenti extra (es. -tA) inoltrati a psql ; stdin = SQL
psql_db() {
  local db="$1"; shift
  docker exec -i -e "PGPASSWORD=${PGPASSWORD_VAL}" "$db" \
    psql -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$db" "$@"
}

# --- SQL di DELETE per ciascun DB (transazione singola) ----------------------
sql_users_db() {
# In produzione i FK sono NO ACTION (create da sync, non dalle migration), quindi
# NON c'è cascade: le tabelle figlie vanno svuotate esplicitamente prima dei soci.
cat <<SQL
BEGIN;
-- 1) figli del socio
DELETE FROM comunicazioni  WHERE socio_id IN (SELECT id FROM socios WHERE societa_id IN ($IDS));
DELETE FROM iscrizioni     WHERE socio_id IN (SELECT id FROM socios WHERE societa_id IN ($IDS));
DELETE FROM socio_contatti WHERE socio_id IN (SELECT id FROM socios WHERE societa_id IN ($IDS));
DELETE FROM socio_storico  WHERE socio_id IN (SELECT id FROM socios WHERE societa_id IN ($IDS));
-- 2) soci
DELETE FROM socios WHERE societa_id IN ($IDS);
-- 3) figli della società
DELETE FROM "SocietaAffiliazioni" WHERE societa_id IN ($IDS);
-- 4) società
DELETE FROM societa WHERE id IN ($IDS);
COMMIT;
SQL
}

sql_payments_db() {
cat <<SQL
BEGIN;
DELETE FROM ricevuta_tokens WHERE societa_id IN ($IDS);
DELETE FROM payments        WHERE societa_id IN ($IDS);
DELETE FROM fornitori       WHERE societa_id IN ($IDS);
-- azzera il self-reference gruppo->gruppo per non violare il FK sui sottogruppi
UPDATE gruppi SET gruppo_id = NULL WHERE societa_id IN ($IDS);
DELETE FROM gruppi          WHERE societa_id IN ($IDS);
DELETE FROM conti           WHERE societa_id IN ($IDS);
COMMIT;
SQL
}

sql_activities_db() {
cat <<SQL
BEGIN;
DELETE FROM "CorsoPresenze"   WHERE "corsoId" IN (SELECT id FROM "Corsi" WHERE "societaId" IN ($IDS));
DELETE FROM "CorsoIscrizioni" WHERE "corsoId" IN (SELECT id FROM "Corsi" WHERE "societaId" IN ($IDS));
DELETE FROM "Corsi"           WHERE "societaId" IN ($IDS);
DELETE FROM "Aree"            WHERE "strutturaId" IN (SELECT id FROM "Strutture" WHERE "societaId" IN ($IDS));
DELETE FROM "Strutture"       WHERE "societaId" IN ($IDS);
DELETE FROM "Attivita"        WHERE "societaId" IN ($IDS);
DELETE FROM "Staff"           WHERE "societaId" IN ($IDS);
COMMIT;
SQL
}

sql_documents_db() {
cat <<SQL
BEGIN;
DELETE FROM moduli WHERE societa_id IN ($IDS);
COMMIT;
SQL
}

sql_products_db() {
cat <<SQL
BEGIN;
DELETE FROM "Products" WHERE "societaId" IN ($IDS);
COMMIT;
SQL
}

# --- SQL di anteprima (conteggi, nessuna modifica) ---------------------------
count_users_db() {
cat <<SQL
SELECT 'societa'   AS tabella, count(*) FROM societa WHERE id IN ($IDS)
UNION ALL SELECT 'socios',      count(*) FROM socios WHERE societa_id IN ($IDS);
SQL
}
count_payments_db() {
cat <<SQL
SELECT 'conti'     AS tabella, count(*) FROM conti     WHERE societa_id IN ($IDS)
UNION ALL SELECT 'gruppi',      count(*) FROM gruppi    WHERE societa_id IN ($IDS)
UNION ALL SELECT 'payments',    count(*) FROM payments  WHERE societa_id IN ($IDS)
UNION ALL SELECT 'fornitori',   count(*) FROM fornitori WHERE societa_id IN ($IDS);
SQL
}
count_activities_db() {
cat <<SQL
SELECT 'Corsi'     AS tabella, count(*) FROM "Corsi"     WHERE "societaId" IN ($IDS)
UNION ALL SELECT 'Strutture',   count(*) FROM "Strutture" WHERE "societaId" IN ($IDS)
UNION ALL SELECT 'Attivita',    count(*) FROM "Attivita"  WHERE "societaId" IN ($IDS)
UNION ALL SELECT 'Staff',       count(*) FROM "Staff"     WHERE "societaId" IN ($IDS);
SQL
}
count_documents_db() { echo "SELECT 'moduli' AS tabella, count(*) FROM moduli WHERE societa_id IN ($IDS);"; }
count_products_db()  { echo "SELECT 'Products' AS tabella, count(*) FROM \"Products\" WHERE \"societaId\" IN ($IDS);"; }

# --- auth_db: utenti legati alle società cancellate + orfani ------------------
# Ritorna la lista (csv) degli id ancora presenti in users_db per una tabella.
# Se vuota, ritorna '-1' così che "NOT IN (-1)" resti SQL valido.
surviving_ids() {  # $1 = tabella (societa | socios)
  local out
  out=$(echo "SELECT COALESCE(string_agg(id::text, ','), '-1') FROM $1;" | psql_db users_db -tA)
  echo "${out:--1}"
}

count_auth_db() {
  local soc socios
  soc=$(surviving_ids societa)
  socios=$(surviving_ids socios)
cat <<SQL
SELECT 'Users (stima)' AS tabella, count(*) FROM "Users"
WHERE "societaId" IN ($IDS)
   OR ("societaId" IS NOT NULL AND "societaId" NOT IN ($soc))
   OR (socio_ref_id IS NOT NULL AND socio_ref_id NOT IN ($socios));
SQL
}

sql_auth_db() {
  local soc socios
  soc=$(surviving_ids societa)      # id società ancora esistenti (post-delete)
  socios=$(surviving_ids socios)    # id soci ancora esistenti (post-delete)
cat <<SQL
BEGIN;
-- Utenti la cui società non esiste più (include le 16 appena cancellate) o il
-- cui socio di riferimento non esiste più. societaId NULL = superuser: preservato.
DELETE FROM "Users"
WHERE ("societaId" IS NOT NULL AND "societaId" NOT IN ($soc))
   OR (socio_ref_id IS NOT NULL AND socio_ref_id NOT IN ($socios));
COMMIT;
SQL
}

# =============================================================================
echo "Società da cancellare (id): $IDS"
echo

echo ">>> ANTEPRIMA righe interessate:"
for db in "${DBS[@]}"; do
  echo "--- $db ---"
  "count_${db}" | psql_db "$db"
done
echo "--- auth_db ---"
count_auth_db | psql_db auth_db
echo

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY_RUN=1 → nessuna cancellazione eseguita."
  exit 0
fi

read -r -p "Confermi la CANCELLAZIONE DEFINITIVA in produzione? Scrivi 'CANCELLA': " CONF
[ "$CONF" = "CANCELLA" ] || { echo "Annullato."; exit 1; }

# --- Backup ------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"
echo ">>> Backup in $BACKUP_DIR ..."
for db in "${BACKUP_DBS[@]}"; do
  echo "    dump $db"
  docker exec -e "PGPASSWORD=${PGPASSWORD_VAL}" "$db" \
    pg_dump -U "$PGUSER" -d "$db" > "$BACKUP_DIR/$db.sql"
done
echo "    backup completato."

# --- Esecuzione DELETE -------------------------------------------------------
# users_db per primo: il cleanup di auth_db legge da qui gli id superstiti.
for db in "${DBS[@]}"; do
  echo ">>> Cancellazione su $db ..."
  "sql_${db}" | psql_db "$db"
done

# auth_db per ultimo: cancella login legati alle società rimosse + orfani.
echo ">>> Cancellazione su auth_db (utenti legati + orfani) ..."
sql_auth_db | psql_db auth_db

echo
echo "FATTO. Backup disponibile in: $BACKUP_DIR"
