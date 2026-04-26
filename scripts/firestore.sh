#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${FIRESTORE_PROJECT_ID:?FIRESTORE_PROJECT_ID not set}"
API_KEY="${FIRESTORE_API_KEY:?FIRESTORE_API_KEY not set}"
BASE="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents"

CMD=$1; shift

case "$CMD" in
  list)
    # list [collection]
    # Returns up to 200 documents in a collection
    COLLECTION=$1
    curl -sf "${BASE}/${COLLECTION}?key=${API_KEY}&pageSize=200"
    ;;
  get)
    # get [collection] [docId]
    COLLECTION=$1; DOC=$2
    curl -sf "${BASE}/${COLLECTION}/${DOC}?key=${API_KEY}"
    ;;
  write)
    # write [collection] [docId] '[{"field":{"stringValue":"val"}, ...}]'
    # PATCH — overwrites all specified fields in the document
    COLLECTION=$1; DOC=$2; FIELDS=$3
    curl -sf -X PATCH \
      -H "Content-Type: application/json" \
      -d "{\"fields\": ${FIELDS}}" \
      "${BASE}/${COLLECTION}/${DOC}?key=${API_KEY}"
    ;;
  create)
    # create [collection] '[{"field":{"stringValue":"val"}, ...}]'
    # POST — auto-generates document ID
    COLLECTION=$1; FIELDS=$2
    curl -sf -X POST \
      -H "Content-Type: application/json" \
      -d "{\"fields\": ${FIELDS}}" \
      "${BASE}/${COLLECTION}?key=${API_KEY}"
    ;;
  delete)
    # delete [collection] [docId]
    COLLECTION=$1; DOC=$2
    curl -sf -X DELETE \
      "${BASE}/${COLLECTION}/${DOC}?key=${API_KEY}"
    ;;
  *)
    echo "Unknown command: $CMD" >&2; exit 1
    ;;
esac
