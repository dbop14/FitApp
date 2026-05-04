# Migrate Synapse from SQLite to PostgreSQL (Docker on a NAS)

This guide matches `production/docker-compose.yml`: **Docker runs on your NAS** (Synology, TrueNAS, ZimaOS, etc.). Postgres runs in `synapse-postgres` with its data directory **bind-mounted to a path on the NAS host** (your appliance’s own storage pool). Synapse keeps **`/data` on a Docker volume** (`synapse_data_prod`, typically backed by NAS storage) for `media_store`, signing keys, logs, and `homeserver.yaml`.

**Storage rule:** Put **`SYNAPSE_POSTGRES_HOST_PATH` on normal NAS volume paths** (e.g. Synology `/volume1/docker/fitapp-synapse-pg`, TrueNAS dataset path). Do **not** point Postgres at a directory that is really an SMB/NFS **client** mount to another machine (same class of problem as SQLite on a bad network filesystem).

## Required `.env` variables (add if missing)

| Variable | Purpose |
|----------|---------|
| `SYNAPSE_POSTGRES_HOST_PATH` | Absolute path **on the NAS where Docker runs** for Postgres data, e.g. `/volume1/docker/fitapp-synapse-pg` (Synology) or your distro’s equivalent |
| `SYNAPSE_POSTGRES_USER` | DB role (default `synapse`; must match `database.args.user` in `homeserver.yaml`) |
| `SYNAPSE_POSTGRES_PASSWORD` | DB password; same value is passed to Synapse as **`PGPASSWORD`** |
| `SYNAPSE_POSTGRES_DB` | Database name (default `synapse`; must match `database.args.dbname`) |

## Prerequisites

- Full backup of the Synapse volume (`synapse_data_prod`) and `homeserver.yaml`.
- Docker network `fitapp` exists on the NAS: `docker network create fitapp`
- A directory **on the NAS host** for Postgres files (SSH into the NAS or use its file UI), owned by the Postgres container user (`postgres:16-alpine` uses uid **70**):

  ```bash
  sudo mkdir -p /volume1/docker/fitapp-synapse-pg   # example; use your NAS path
  sudo chown 70:70 /volume1/docker/fitapp-synapse-pg
  ```

- Set in `.env` (see `.env.example`):

  - `SYNAPSE_POSTGRES_HOST_PATH` — absolute host path above  
  - `SYNAPSE_POSTGRES_USER` (default `synapse`)  
  - `SYNAPSE_POSTGRES_PASSWORD` — strong secret  
  - `SYNAPSE_POSTGRES_DB` (default `synapse`)  

  The Synapse container gets the same password via `PGPASSWORD` from `SYNAPSE_POSTGRES_PASSWORD`. **Do not run `VACUUM` on the SQLite file** between runs of `synapse_port_db` (Synapse docs).

## Overview (two-phase port)

1. **Bulk copy**: While Synapse still runs on SQLite, copy `homeserver.db` to a snapshot and run `synapse_port_db` against that snapshot into Postgres.  
2. **Cutover**: Stop Synapse, run `synapse_port_db` once more against the **live** `homeserver.db`, switch `homeserver.yaml` to Postgres, start Synapse, then retire SQLite.

Synapse docs: [Porting from SQLite](https://element-hq.github.io/synapse/latest/postgres.html#porting-from-sqlite).

---

## Step 1 — Add Postgres and prepare config on the NAS volume

1. Add the new env vars to `.env` and create the Postgres data directory on the NAS (`chown 70:70`).
2. Start **only** Postgres to initialize the cluster:

   ```bash
   cd production
   docker compose up -d synapse-postgres
   docker compose ps   # wait until healthy
   ```

3. On the **NAS** Synapse volume, keep your existing `homeserver.yaml` backed up:

   ```bash
   docker run --rm -v production_synapse_data_prod:/data alpine \
     sh -c 'cp -a /data/homeserver.yaml /data/homeserver.yaml.pre_postgres.$(date +%Y%m%d) || true'
   ```

4. Create **`homeserver.postgres.yaml`** on the volume: same content as your future production `homeserver.yaml` with the **Postgres** `database` block (from `production/synapse_data/homeserver.yaml` in this repo). It must:

   - Use `database.name: psycopg2` and `host: synapse-postgres`  
   - **Omit** `password` under `database.args` (compose sets `PGPASSWORD`)  
   - Preserve your real `registration_shared_secret`, `macaroon_secret_key`, `form_secret`, `signing_key_path`, `media_store_path`, `listeners`, etc.

   Easiest: copy the repo reference file, then paste your three secrets from the backup.

---

## Step 2 — First port (snapshot, Synapse can stay up on SQLite)

1. While Synapse is still using SQLite, copy the DB:

   ```bash
   docker run --rm -v production_synapse_data_prod:/data alpine \
     sh -c 'cp -a /data/homeserver.db /data/homeserver.db.snapshot && ls -la /data/homeserver.db*'
   ```

2. Run the port script **inside the Synapse image**, attaching the volume and the `fitapp` network so `synapse-postgres` resolves. The image entrypoint is `/start.py`, so override the entrypoint to the `synapse_port_db` CLI (installed as `/usr/local/bin/synapse_port_db`):

   ```bash
   docker run --rm \
     --entrypoint synapse_port_db \
     --network fitapp \
     -e PGHOST=synapse-postgres \
     -e PGPORT=5432 \
     -e PGUSER=synapse \
     -e PGDATABASE=synapse \
     -e PGPASSWORD="$SYNAPSE_POSTGRES_PASSWORD" \
     -v production_synapse_data_prod:/data \
     matrixdotorg/synapse:latest \
       --sqlite-database /data/homeserver.db.snapshot \
       --postgres-config /data/homeserver.postgres.yaml
   ```

   If that entrypoint is missing in an older image, use:

   ```bash
   docker run --rm --entrypoint python \
     --network fitapp \
     -e PGHOST=synapse-postgres -e PGPORT=5432 -e PGUSER=synapse -e PGDATABASE=synapse \
     -e PGPASSWORD="$SYNAPSE_POSTGRES_PASSWORD" \
     -v production_synapse_data_prod:/data \
     matrixdotorg/synapse:latest \
     -m synapse._scripts.synapse_port_db \
       --sqlite-database /data/homeserver.db.snapshot \
       --postgres-config /data/homeserver.postgres.yaml
   ```

3. Expect this to take a while on large DBs. It is safe to stop and re-run.

---

## Step 3 — Final port (Synapse stopped, live SQLite)

1. Stop Synapse (leave Postgres running):

   ```bash
   docker compose stop synapse
   ```

2. Run the port again against the **live** database:

   ```bash
   docker run --rm \
     --entrypoint synapse_port_db \
     --network fitapp \
     -e PGHOST=synapse-postgres \
     -e PGPORT=5432 \
     -e PGUSER=synapse \
     -e PGDATABASE=synapse \
     -e PGPASSWORD="$SYNAPSE_POSTGRES_PASSWORD" \
     -v production_synapse_data_prod:/data \
     matrixdotorg/synapse:latest \
       --sqlite-database /data/homeserver.db \
       --postgres-config /data/homeserver.postgres.yaml
   ```

3. When it finishes successfully, activate Postgres config:

   ```bash
   docker run --rm -v production_synapse_data_prod:/data alpine \
     sh -c 'mv /data/homeserver.yaml /data/homeserver.yaml.sqlite.bak && cp -a /data/homeserver.postgres.yaml /data/homeserver.yaml'
   ```

4. Start the full stack (or at least Postgres + Synapse):

   ```bash
   docker compose up -d
   ```

5. Verify Synapse:

   ```bash
   docker compose logs -f synapse
   curl -sS http://127.0.0.1:8008/_matrix/client/versions | head
   ```

---

## Step 4 — Temporary Postgres client container (optional checks)

No need to “install the client” on the host; use the official image:

```bash
docker run --rm -it --network fitapp \
  -e PGPASSWORD="$SYNAPSE_POSTGRES_PASSWORD" \
  postgres:16-alpine \
  psql -h synapse-postgres -U synapse -d synapse -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

List tables (sanity):

```bash
docker run --rm --network fitapp \
  -e PGPASSWORD="$SYNAPSE_POSTGRES_PASSWORD" \
  postgres:16-alpine \
  psql -h synapse-postgres -U synapse -d synapse -c '\dt' | head -50
```

---

## Step 5 — Clean up SQLite (only after stable Postgres operation)

After several days of stable operation (and backups):

```bash
docker compose stop synapse
docker run --rm -v production_synapse_data_prod:/data alpine \
  sh -c 'rm -f /data/homeserver.db /data/homeserver.db.snapshot /data/homeserver.db-wal /data/homeserver.db-shm'
docker compose start synapse
```

Keep `homeserver.yaml.sqlite.bak` until you are confident.

---

## Warnings and gotchas

| Topic | Detail |
|--------|--------|
| **Synapse requires PostgreSQL ≥ 14** | Image `postgres:16-alpine` satisfies this. |
| **Locale** | `POSTGRES_INITDB_ARGS` uses `--locale=C` so COLLATE/CTYPE match Synapse’s checks. |
| **Password in YAML** | This setup omits `password` in `homeserver.yaml` and uses **`PGPASSWORD`** in Compose. If your Synapse/libpq build ever ignores env, add `password:` under `database.args` to match `SYNAPSE_POSTGRES_PASSWORD`. |
| **Never VACUUM SQLite** between `synapse_port_db` runs | Can break consistency of the port (official warning). |
| **Postgres disk** | Use a directory on the **NAS’s own volumes** (direct block storage). Avoid Postgres data on a **remote** SMB/NFS mount the NAS mounts as a client, or other high-latency filesystems. |
| **`homeserver.postgres.yaml`** | Used only for tooling and one-time port; keep it or remove after cutover. |
| **Project/volume names** | If your Compose project name differs, replace `production_synapse_data_prod` with your actual volume name (`docker volume ls \| grep synapse`). |
| **PG user vs YAML** | If you change `SYNAPSE_POSTGRES_USER`, update `database.args.user` in `homeserver.yaml` to match. |

---

## Fresh install (no SQLite to migrate)

1. Create the Postgres data directory on the NAS and `.env` as above.  
2. `docker compose up -d synapse-postgres` and wait until healthy.  
3. Generate keys and log config on the NAS volume (example):

   ```bash
   docker run --rm \
     -v production_synapse_data_prod:/data \
     -e SYNAPSE_SERVER_NAME=fitapp.local \
     -e SYNAPSE_REPORT_STATS=no \
     matrixdotorg/synapse:latest generate
   ```

4. Replace **`/data/homeserver.yaml`** with the Postgres version from this repo, **preserving** the three secrets and paths from the generated file (or paste generated secrets into the repo template).  
5. Remove the generated SQLite file if present: `rm /data/homeserver.db*` inside the volume.  
6. `docker compose up -d` — Synapse will create schema on first start against empty Postgres.

---

## Rollback

- Stop Synapse, restore `/data/homeserver.yaml` from `homeserver.yaml.sqlite.bak`, ensure `homeserver.db` (and `-wal`/`-shm` if any) are present from backup, remove or ignore Postgres service temporarily, start Synapse on SQLite again.
