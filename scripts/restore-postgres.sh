#!/usr/bin/env bash
# Restore one or all databases from a backup archive produced by backup-postgres.sh.
# Usage: ./scripts/restore-postgres.sh backups/eduplatform_YYYYMMDD_HHMMSS.tar.gz [database]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "${ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

ARCHIVE="${1:?archive path required}"
ONLY_DB="${2:-}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

if [[ "${ARCHIVE}" == *.gpg ]]; then
  gpg --decrypt "${ARCHIVE}" | tar -xzf - -C "${WORK}"
else
  tar -xzf "${ARCHIVE}" -C "${WORK}"
fi

POSTGRES_CONTAINER="$(docker compose -f "${COMPOSE_FILE}" ps -q postgres)"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
STAMP_DIR="$(find "${WORK}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

for dump in "${STAMP_DIR}"/*.dump; do
  db="$(basename "${dump}" .dump)"
  if [ -n "${ONLY_DB}" ] && [ "${db}" != "${ONLY_DB}" ]; then
    continue
  fi
  echo "Restoring ${db}..."
  docker exec -i "${POSTGRES_CONTAINER}" \
    pg_restore -U "${POSTGRES_USER}" -d "${db}" --clean --if-exists < "${dump}"
done

echo "Restore finished."
