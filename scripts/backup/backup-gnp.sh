#!/usr/bin/env bash
# Backup giornaliero di GNP (prod e prod2) sull'host, lanciato dalla crontab di dave
# (ore 3:30). Per ogni ambiente copia: i 7 database (pg_dump formato custom, verificati
# con pg_restore --list), il volume degli upload e i file .env non versionati
# (docker/.env e services/*/.env, necessari al ripristino).
# Conservazione: 7 copie giornaliere, 4 settimanali (domenica), 6 mensili (giorno 1).
# Esito dell'ultimo giro in $DEST/ultimo-esito, log in $DEST/backup.log.
# Ripristino di un database: docker exec -i <db>_<amb> pg_restore -U postgres -d <db> --clean --if-exists < <db>.dump
set -Eeuo pipefail   # -E: la trap ERR vale anche dentro le funzioni
umask 077

DEST=${GNP_BACKUP_DIR:-$HOME/backups/gnp-auto}
AMBIENTI=(prod prod2)   # cartelle ~/management-software-<amb>, suffisso container _<amb>
DATABASES=(auth_db users_db payments_db activities_db documents_db products_db template_db)
GIORNI=7; SETTIMANE=4; MESI=6

oggi=$(date +%F)
lavoro="$DEST/daily/.in-corso-$oggi"
finale="$DEST/daily/$oggi"
log() { echo "$(date '+%F %T') $*"; }

mkdir -p "$DEST/daily" "$DEST/weekly" "$DEST/monthly"
exec >> "$DEST/backup.log" 2>&1
exec 9>"$DEST/.lock"
flock -n 9 || { log "ERRORE: un altro backup è in corso"; exit 1; }

esito() { printf '%s %s %s\n' "$(date '+%F %T')" "$1" "$2" > "$DEST/ultimo-esito"; }
trap 'esito ERRORE "fallito alla riga $LINENO"; log "ERRORE alla riga $LINENO"; rm -rf "${lavoro:?}"' ERR

rm -rf "${lavoro:?}"
mkdir -p "$lavoro"
log "inizio backup in $finale"

for amb in "${AMBIENTI[@]}"; do
  out="$lavoro/$amb"; mkdir -p "$out"
  for db in "${DATABASES[@]}"; do
    c="${db}_${amb}"
    docker exec "$c" pg_dump -U postgres -Fc "$db" > "$out/$db.dump"
    # Verifica: il dump deve essere leggibile (template_db in prod può essere vuoto)
    elenco=$(docker exec -i "$c" pg_restore --list < "$out/$db.dump")
    tabelle=$(grep -c ' TABLE ' <<< "$elenco" || true)
    log "  $amb/$db: $(du -h "$out/$db.dump" | cut -f1), $tabelle tabelle"
  done

  vol="backend_${amb}_uploads_data"
  docker run --rm -v "$vol":/dati:ro -v "$out":/out alpine \
    sh -c 'tar -C /dati -czf /out/uploads.tar.gz . && chown '"$(id -u):$(id -g)"' /out/uploads.tar.gz'
  chmod 600 "$out/uploads.tar.gz"
  tar -tzf "$out/uploads.tar.gz" > /dev/null
  log "  $amb/uploads: $(du -h "$out/uploads.tar.gz" | cut -f1)"

  base="$HOME/management-software-$amb"
  (cd "$base" && find backend/docker backend/services frontend -maxdepth 3 -name .env -path '*/.env' \
     -not -path '*/node_modules/*' -print0 | tar --null -czf "$out/env.tar.gz" -T -)
  log "  $amb/env: $(tar -tzf "$out/env.tar.gz" | wc -l) file .env"
done

(cd "$lavoro" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)

rm -rf "${finale:?}"
mv "$lavoro" "$finale"

# Copie settimanali e mensili: hard link ai file del giorno, nessuno spazio in più
[ "$(date +%u)" = 7 ] && { rm -rf "$DEST/weekly/$oggi"; cp -al "$finale" "$DEST/weekly/$oggi"; }
[ "$(date +%d)" = 01 ] && { rm -rf "$DEST/monthly/$oggi"; cp -al "$finale" "$DEST/monthly/$oggi"; }

pulisci() { # tiene le N cartelle più recenti
  local dir=$1 tieni=$2
  find "$dir" -mindepth 1 -maxdepth 1 -type d -name '????-??-??' | sort -r | tail -n +$((tieni + 1)) | while read -r vecchia; do
    rm -rf "${vecchia:?}"; log "  rimossa $vecchia"
  done
}
pulisci "$DEST/daily" "$GIORNI"
pulisci "$DEST/weekly" "$SETTIMANE"
pulisci "$DEST/monthly" "$MESI"

# Il log non passa da logrotate (niente sudo): tiene le ultime 5000 righe
tail -n 5000 "$DEST/backup.log" > "$DEST/backup.log.tmp" && cat "$DEST/backup.log.tmp" > "$DEST/backup.log" && rm -f "$DEST/backup.log.tmp"

totale=$(du -sh "$finale" | cut -f1)
libero=$(df -h "$DEST" | awk 'NR==2 {print $4 " liberi (" $5 " usato)"}')
esito OK "$finale ($totale, disco: $libero)"
log "fine: $finale ($totale, disco: $libero)"
