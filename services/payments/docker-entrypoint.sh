#!/bin/sh
set -e

# Assicura che le dipendenze dichiarate in package.json siano installate nel
# node_modules (montato come volume anonimo in compose). Necessario perché il
# volume può "mascherare" le dipendenze nuove aggiunte dopo la prima build:
# in questo modo ogni deploy/restart allinea automaticamente le dipendenze
# (es. multer) senza interventi manuali, anche in produzione.
echo "[entrypoint] Allineamento dipendenze (npm install)..."
npm install --no-audit --no-fund

echo "[entrypoint] Avvio applicazione..."
exec "$@"
