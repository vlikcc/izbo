#!/usr/bin/env bash
# Backup all EduPlatform PostgreSQL databases from the production compose stack.
# Usage: ./scripts/backup-postgres.sh [backup_dir]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "${ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

BACKUP_DIR="${1:-${BACKUP_DIR:-./backups}}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_DIR="${BACKUP_DIR}/${TIMESTAMP}"

DATABASES=(
  eduplatform_auth
  eduplatform_user
  eduplatform_classroom
  eduplatform_homework
  eduplatform_exam
  eduplatform_notification
  eduplatform_file
)

mkdir -p "${OUTPUT_DIR}"

POSTGRES_CONTAINER="$(docker compose -f "${COMPOSE_FILE}" ps -q postgres)"
if [ -z "${POSTGRES_CONTAINER}" ]; then
  echo "postgres container not found. Is the stack running?" >&2
  exit 1
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"

for db in "${DATABASES[@]}"; do
  echo "Backing up ${db}..."
  docker exec "${POSTGRES_CONTAINER}" \
    pg_dump -U "${POSTGRES_USER}" -Fc "${db}" \
    > "${OUTPUT_DIR}/${db}.dump"
done

ARCHIVE="${BACKUP_DIR}/eduplatform_${TIMESTAMP}.tar.gz"
tar -czf "${ARCHIVE}" -C "${BACKUP_DIR}" "${TIMESTAMP}"
rm -rf "${OUTPUT_DIR}"

if command -v gpg >/dev/null 2>&1 && [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  gpg --yes --encrypt --recipient "${BACKUP_GPG_RECIPIENT}" --output "${ARCHIVE}.gpg" "${ARCHIVE}"
  rm -f "${ARCHIVE}"
  ARCHIVE="${ARCHIVE}.gpg"
fi

find "${BACKUP_DIR}" -name 'eduplatform_*.tar.gz*' -mtime "+${RETENTION_DAYS}" -delete

echo "Backup created: ${ARCHIVE}"
