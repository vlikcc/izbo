#!/usr/bin/env bash
# Copy the MinIO data volume to a timestamped archive.
# Usage: ./scripts/backup-minio.sh [backup_dir]
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
mkdir -p "${BACKUP_DIR}"

MINIO_CONTAINER="$(docker compose -f "${COMPOSE_FILE}" ps -q minio)"
if [ -z "${MINIO_CONTAINER}" ]; then
  echo "minio container not found." >&2
  exit 1
fi

ARCHIVE="${BACKUP_DIR}/minio_${TIMESTAMP}.tar.gz"
docker exec "${MINIO_CONTAINER}" tar -C /data -czf - . > "${ARCHIVE}"
find "${BACKUP_DIR}" -name 'minio_*.tar.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "MinIO backup created: ${ARCHIVE}"
