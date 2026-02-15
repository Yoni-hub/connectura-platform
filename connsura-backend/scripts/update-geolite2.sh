#!/usr/bin/env bash
set -euo pipefail

EDITION_ID=${MAXMIND_EDITION_ID:-GeoLite2-City}
LICENSE_KEY=${MAXMIND_LICENSE_KEY:-}
if [[ -z "$LICENSE_KEY" ]]; then
  echo "MAXMIND_LICENSE_KEY is required" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
TARGET_DIR=${GEOIP_DB_DIR:-$ROOT_DIR/geo}
DB_PATH=${GEOIP_DB_PATH:-$TARGET_DIR/${EDITION_ID}.mmdb}

TMP_DIR=$(mktemp -d)
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

URL="https://download.maxmind.com/app/geoip_download?edition_id=${EDITION_ID}&license_key=${LICENSE_KEY}&suffix=tar.gz"

echo "Downloading ${EDITION_ID}..."
curl -fsSL "$URL" -o "$TMP_DIR/geoip.tar.gz"

echo "Extracting..."
tar -xzf "$TMP_DIR/geoip.tar.gz" -C "$TMP_DIR"

MMDB_PATH=$(find "$TMP_DIR" -type f -name "${EDITION_ID}.mmdb" | head -n 1)
if [[ -z "$MMDB_PATH" ]]; then
  echo "Failed to locate ${EDITION_ID}.mmdb in archive" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp "$MMDB_PATH" "$DB_PATH"

echo "GeoLite2 database updated at $DB_PATH"
