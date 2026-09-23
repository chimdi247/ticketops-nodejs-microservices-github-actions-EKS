# Local development — single `docker compose` stack

Everything — the app **and** the full observability stack — runs from one
`docker-compose.yml` at the repo root.

```bash
docker compose up -d --build
```

First boot takes a minute or two (image builds + Postgres init + admin
seed). Then:

| What | URL | Notes |
|---|---|---|
| Dashboard (public + admin) | http://localhost:5173 | browse events → book → `/admin` |
| Admin login | — | **admin@example.com / password123** (seeded automatically, password stored bcrypt-hashed) |
| events-api | http://localhost:3000 | `/health`, `/ready`, `/metrics`, `/api/events`, `/api/bookings` |
| admin-api | http://localhost:4000 | `/health`, `/ready`, `/metrics`, `/auth/login` |
| Redis UI (Redis Commander) | http://localhost:8082 | **admin / admin** — browse `seat:held:*` locks and the `bookings:queue` list |
| Grafana | http://localhost:3001 | **admin / admin** — Prometheus, Loki, Tempo pre-wired as datasources |
| Mailpit (SMTP inbox) | http://localhost:8025 | catches every alert email — Alertmanager and Grafana both send here |
| Prometheus | http://localhost:9090 | metrics + alert rules |
| Alertmanager | http://localhost:9093 | firing alerts (no external notifier configured locally) |
| Tempo | http://localhost:3200 | trace query API |
| Loki | http://localhost:3100 | log query API |
| LocalStack (S3 + SES) | http://localhost:4566 | emulates AWS for bookings-worker |
| cAdvisor | http://localhost:8081 | raw per-container metrics UI |
| node-exporter | http://localhost:9100/metrics | raw host metrics |

## What's wired up

- **App**: postgres, redis, events-api, admin-api, bookings-worker, dashboard
  (nginx), plus `localstack` standing in for S3/SES so QR-code upload +
  confirmation "emails" work without real AWS credentials, and
  `db-seed-admin`, a one-off job that hashes and stores the default admin
  password before admin-api starts.
- **Traces**: each Node service auto-instruments HTTP/Express/pg/ioredis via
  the OpenTelemetry SDK (`apps/*/src/tracing.js`, preloaded with
  `node -r ./src/tracing.js`) and exports OTLP to `otel-collector`, which
  forwards to `tempo`. No existing metrics or log code was touched.
- **Metrics**: unchanged — each service still exposes its own `prom-client`
  `/metrics` endpoint exactly as before; `prometheus` just scrapes them,
  plus `node-exporter` (host CPU/mem) and `cadvisor` (per-container
  CPU/mem).
- **Logs**: unchanged — services still log structured JSON via `winston` to
  stdout; `promtail` tails every container's stdout (via the Docker socket)
  and ships it to `loki`. No logger code was touched.
- **Dashboards**: auto-provisioned into Grafana from
  `observability/grafana/dashboards/` — one per service
  (`events-api`, `admin-api`, `bookings-worker`) plus a
  `Platform Overview` dashboard for host/container CPU & memory and
  active alerts. Each shows uptime, latency (P50/P95/P99), error rate,
  successful vs failed request counts, business KPIs (bookings, events
  created, emails sent, queue depth), and CPU/memory.
- **Alerting**: Prometheus rules in `observability/prometheus/alerts.yml`
  fire when **host or container CPU/memory exceeds 50%**, plus
  service-down and error-rate/latency SLO alerts, routed through
  `alertmanager`, which emails them via `mailpit` — a local SMTP catcher,
  not a real mail server, so nothing leaves your machine. Grafana's own
  alerting engine is wired to the same Mailpit instance for any
  Grafana-managed rules you add on top. View delivered alert emails at
  http://localhost:8025, and firing alerts at http://localhost:9093 or in
  Grafana's Alerting UI.

## Admin login

Seeded by `apps/admin-api/src/scripts/seedAdmin.js` (bcrypt-hashed, stored
in the `admins` table created by `db/init/002-admins.sql`):

```
email:    admin@example.com
password: password123
```

Override before first boot with `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`
on the `db-seed-admin` service in `docker-compose.yml`.

## Load / stress / spike testing

```bash
./test/load-test.sh      # steady realistic traffic
./test/stress-test.sh    # push past capacity — some failures expected
./test/spike-test.sh     # sudden burst then sudden drop
```

See `test/README.md`. Watch the Grafana dashboards while they run.

## Troubleshooting

- **Fresh start**: `docker compose down -v` wipes all volumes (Postgres
  data, Grafana dashboards state, Prometheus/Loki/Tempo storage) — next
  `up` re-seeds everything from scratch.
- **cAdvisor / node-exporter show partial data on macOS or Windows**:
  Docker Desktop runs containers inside a VM, so host-level metrics are
  for that VM, not your physical machine — this is a Docker Desktop
  limitation, not a config issue. Full host metrics work as expected on
  native Linux.
- **QR download link in confirmation "emails"**: points at
  `http://localstack:4566/...`, which resolves inside the compose network
  but not from your host browser directly (LocalStack has no real inbox —
  SES calls are accepted and logged, not delivered). Fetch it from inside
  the network, e.g. `docker compose exec bookings-worker wget -qO- <url>`.
- **Admin login fails right after startup**: `admin-api` waits for
  `db-seed-admin` to finish before it starts, so this shouldn't happen —
  but if it does, check `docker compose logs db-seed-admin`.
