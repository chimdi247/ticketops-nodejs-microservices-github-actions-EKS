#!/usr/bin/env bash
# Sudden burst of traffic followed by a sudden drop — checks how fast the
# system recovers (e.g. "tickets just went on sale" scenario).
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${DIR}/_run.sh" "${DIR}/k6/spike-test.js" "SPIKE TEST"
