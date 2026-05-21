#!/usr/bin/env bash
# Create the EduPlatform MinIO bucket if it does not exist (run after stack is up).
set -euo pipefail

BUCKET="${MINIO_BUCKET:-eduplatform}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

source .env 2>/dev/null || true

MINIO_USER="${MINIO_ROOT_USER:?MINIO_ROOT_USER required}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD required}"

NETWORK="$(docker compose -f "${COMPOSE_FILE}" ps -q minio | head -1 | xargs -I{} docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' {})"

docker run --rm --network "${NETWORK}" minio/mc:latest sh -c "
  mc alias set local http://minio:9000 '${MINIO_USER}' '${MINIO_PASS}'
  mc mb --ignore-existing local/${BUCKET}
"

echo "Bucket '${BUCKET}' is ready."
