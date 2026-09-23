#!/usr/bin/env bash
# Steady, realistic traffic — normal peak usage. Run with the stack up:
#   docker compose up -d
#   ./test/load-test.sh
# Override target with: BASE_URL=http://localhost:3000 ./test/load-test.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${DIR}/_run.sh" "${DIR}/k6/load-test.js" "LOAD TEST"
