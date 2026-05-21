#!/usr/bin/env bash
# Backup all EduPlatform PostgreSQL databases from the production compose stack.
# Usage: ./scripts/backup-postgres.sh [backup_dir]
# Cron example (daily at 02:00):
#   0 2 * * * cd /opt/eduplatform && ./scripts/backup-postgres.sh /var/backups/eduplatform

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
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

tar -czf "${BACKUP_DIR}/eduplatform_${TIMESTAMP}.tar.gz" -C "${BACKUP_DIR}" "${TIMESTAMP}"
rm -rf "${OUTPUT_DIR}"

echo "Backup created: ${BACKUP_DIR}/eduplatform_${TIMESTAMP}.tar.gz"
