#!/bin/sh
# Catcher delle email per l'ambiente di DEV (mai in produzione).
# Avvia Mailpit sulla rete docker di dev: users_ms invia lì tutte le email se nel
# suo services/users/.env ci sono MAIL_SINK_HOST=mailpit e MAIL_SINK_PORT=1025.
# Pagina web: http://<host-dev>:8025 (utente "dev", password in MAILPIT_PASSWORD).
#
# Uso sull'host di dev:  MAILPIT_PASSWORD='...' sh scripts/dev-mailpit.sh
set -e
: "${MAILPIT_PASSWORD:?Imposta MAILPIT_PASSWORD}"
docker rm -f mailpit >/dev/null 2>&1 || true
docker run -d --name mailpit --restart unless-stopped --network docker_app_network \
  -p 8025:8025 \
  -e MP_UI_AUTH="dev:${MAILPIT_PASSWORD}" \
  -e MP_MAX_MESSAGES=1000 -e MP_SMTP_AUTH_ACCEPT_ANY=1 -e MP_SMTP_AUTH_ALLOW_INSECURE=1 \
  -e TZ=Europe/Rome \
  axllent/mailpit:v1.31.6
echo "Mailpit avviato: http://$(hostname -I | cut -d' ' -f1):8025"
