#!/usr/bin/env bash
# Ramps well past normal capacity to find the breaking point. Some
# threshold failures at the top of the ramp are expected — that's the
# point. Watch the Grafana dashboards while this runs.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${DIR}/_run.sh" "${DIR}/k6/stress-test.js" "STRESS TEST"
