# Load / Stress / Spike tests

Shell scripts that drive the k6 scripts in `k6/` against the running
docker-compose stack.

```bash
docker compose up -d
./test/load-test.sh     # steady realistic traffic
./test/stress-test.sh   # push past capacity to find the breaking point
./test/spike-test.sh    # sudden burst then sudden drop
```

Each script uses your local `k6` binary if it's on `PATH`; otherwise it
runs `grafana/k6` in Docker on the `ticketops-network` compose network.

Override the target with `BASE_URL`, e.g. against admin-api or a
non-default port:

```bash
BASE_URL=http://localhost:3000 ./test/load-test.sh
```

Watch results live in Grafana (http://localhost:3001) on the
`events-api — Service Dashboard` and `Platform Overview` dashboards
while a test runs.
