#!/bin/sh
set -e

echo "[entrypoint] Waiting for database and running migrations..."

MAX_RETRIES=10
i=0
until npx sequelize-cli db:migrate; do
  i=$((i + 1))
  if [ $i -ge $MAX_RETRIES ]; then
    echo "[entrypoint] Migration failed after $MAX_RETRIES attempts. Aborting."
    exit 1
  fi
  echo "[entrypoint] Migration attempt $i failed, retrying in 3s..."
  sleep 3
done

echo "[entrypoint] Migrations complete. Starting app..."
exec "$@"
