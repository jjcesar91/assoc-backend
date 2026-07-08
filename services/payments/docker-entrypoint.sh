#!/bin/sh
set -e

# Assicura che le dipendenze dichiarate in package.json siano installate nel
# node_modules (montato come volume anonimo in compose). Necessario perché il
# volume può "mascherare" le dipendenze nuove aggiunte dopo la prima build:
# in questo modo ogni deploy/restart allinea automaticamente le dipendenze
# (es. multer) senza interventi manuali, anche in produzione.
echo "[entrypoint] Allineamento dipendenze (npm install)..."
npm install --no-audit --no-fund

# Aggancio delle migrazioni al deploy. Prima si esegue il baseline una-tantum
# (marca come applicate le migration di solo-schema sui DB legacy costruiti da
# sync, evitando errori "already exists"), poi si applicano le migration pendenti
# (es. le migration di dato come clear-sezione-asd-gruppi). Con retry perché il
# database potrebbe non essere ancora pronto all'avvio del container.
echo "[entrypoint] Baseline + migrazioni database..."
MAX_RETRIES=10
i=0
until node scripts/baseline-migrations.js && npx sequelize-cli db:migrate; do
  i=$((i + 1))
  if [ "$i" -ge "$MAX_RETRIES" ]; then
    echo "[entrypoint] Migrazioni fallite dopo $MAX_RETRIES tentativi. Interrompo."
    exit 1
  fi
  echo "[entrypoint] Tentativo migrazione $i fallito, riprovo tra 3s..."
  sleep 3
done
echo "[entrypoint] Migrazioni completate."

echo "[entrypoint] Avvio applicazione..."
exec "$@"
