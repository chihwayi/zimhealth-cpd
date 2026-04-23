#!/usr/bin/env bash
set -euo pipefail

: "${MINIO_ENDPOINT:=http://127.0.0.1:9000}"
: "${MINIO_ROOT_USER:=minioadmin}"
: "${MINIO_ROOT_PASSWORD:=minioadmin}"
: "${S3_BUCKET_NAME:=zimhealth-media}"

if ! command -v mc >/dev/null 2>&1; then
  echo "MinIO client 'mc' not installed."
  echo "Install: brew install minio/stable/mc"
  exit 1
fi

mc alias set localminio "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null
mc mb -p "localminio/${S3_BUCKET_NAME}" >/dev/null || true
mc anonymous set download "localminio/${S3_BUCKET_NAME}" >/dev/null || true

echo "MinIO bucket ready: ${S3_BUCKET_NAME}"
