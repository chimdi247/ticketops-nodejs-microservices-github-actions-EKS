#!/usr/bin/env bash
# Shared runner used by load-test.sh / stress-test.sh / spike-test.sh.
# Usage: _run.sh <k6-script-path> <label>
set -euo pipefail

SCRIPT_PATH="$1"
LABEL="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_NAME="${TICKETOPS_NETWORK:-ticketops-network}"

echo "── TicketOps ${LABEL} ──────────────────────────────────────────"

if command -v k6 >/dev/null 2>&1; then
  BASE_URL="${BASE_URL:-http://localhost:3000}"
  echo "Using local k6 binary against ${BASE_URL}"
  BASE_URL="${BASE_URL}" k6 run "${SCRIPT_PATH}"
else
  BASE_URL="${BASE_URL:-http://events-api:3000}"
  echo "k6 not found locally — running via Docker (grafana/k6) on network '${NETWORK_NAME}' against ${BASE_URL}"
  docker run --rm -i \
    --network "${NETWORK_NAME}" \
    -e BASE_URL="${BASE_URL}" \
    -v "${SCRIPT_DIR}/k6:/scripts:ro" \
    grafana/k6 run "/scripts/$(basename "${SCRIPT_PATH}")"
fi
