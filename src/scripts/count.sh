#!/usr/bin/env bash
set -euo pipefail

source .env.local

# NOTE: see share.ts for bucket usage by the app
BUCKET="gs://$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET/share"

# List every object (recursively)
lines=$(gsutil ls -r "${BUCKET}/**.json.enc")

echo "$lines"

count=$(echo "$lines" \
  | wc -l \
  | tr -d '[:space:]')

echo "Found ${count} objects in ${BUCKET}"

# TODO: use gcloud storage CLI
# TODO: limit to after Jan 1 2026
