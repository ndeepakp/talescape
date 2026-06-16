# Deploying Talerooms to Fly.io

One always-on machine in Singapore (`sin`), a managed Postgres with pgvector, a
persistent volume for uploads, and the `talerooms.com` domain with automatic TLS.
Config lives in `fly.toml`; the image is built from `Dockerfile`.

Estimated cost: ~$5–15/month.

---

## 0. One-time: account + CLI auth (you do this)

```bash
fly auth login          # opens a browser; sign up / log in
# Add a payment method (required even on the cheap plan):
fly dashboard           # → Billing
```

`flyctl` is already installed. Everything below can be run for you once you're
logged in — the auth token is stored locally.

---

## 1. Create the app + uploads volume

```bash
fly apps create talerooms          # if the name is taken, pick another & update fly.toml
fly volumes create talerooms_uploads --region sin --size 1 -a talerooms
```

## 2. Create Postgres (with pgvector) and attach it

```bash
# Managed Postgres (current Fly default):
fly mpg create --name talerooms-db --region sin
# Attach it to the app — this sets the DATABASE_URL secret automatically:
fly mpg attach talerooms-db -a talerooms
```

Then enable the extension and load the schema:

```bash
# Open a psql proxy to the DB from your laptop:
fly mpg connect talerooms-db          # gives you a psql prompt
#   In psql:  CREATE EXTENSION IF NOT EXISTS vector;  then \q
```

## 3. Load the schema (migrations)

The `db/*.sql` files aren't in the runtime image, so apply them from your laptop
through a proxy:

```bash
fly mpg proxy talerooms-db            # forwards the DB to localhost:5432 (leave running)
# In another terminal, apply every migration in order:
for f in db/*.sql; do psql "postgresql://localhost:5432/<dbname>" -f "$f"; done
```

## 4. Set the remaining secrets

```bash
fly secrets set \
  BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  BETTER_AUTH_URL="https://talerooms.com" \
  -a talerooms
```

(`DATABASE_URL` was set by the attach step in #2.)

## 5. Deploy

```bash
fly deploy -a talerooms
```

This builds the Dockerfile, pushes the image, and boots one machine in `sin`.
Check it: `fly logs -a talerooms` and `fly status -a talerooms`.

## 6. Connect the domain `talerooms.com`

```bash
fly certs add talerooms.com -a talerooms
fly certs add www.talerooms.com -a talerooms
fly ips list -a talerooms        # note the v4 (A) and v6 (AAAA) addresses
```

At your domain registrar's DNS, add:
- `A`    `@`   → the Fly **v4** address
- `AAAA` `@`   → the Fly **v6** address
- `CNAME` `www` → `talerooms.com`

TLS is issued automatically once DNS resolves (a few minutes). Verify:
`fly certs show talerooms.com -a talerooms`.

---

## Notes
- **One machine on purpose.** The uploads volume is tied to a single machine, so
  we keep `min_machines_running = 1` and don't autoscale to many. To go
  multi-machine later, move uploads to S3/R2 (see `deployment.md`, Part A #2).
- **Memory.** `fly.toml` requests 1 GB for the in-process embedding model. If a
  publish ever OOMs, bump `[[vm]] memory` to `2048` and `fly deploy`.
- **Redeploys.** After any code change: `git push` then `fly deploy -a talerooms`.
- **Auth origins.** `https://talerooms.com` and `www` are already in the app's
  trusted origins (`src/lib/auth.ts`), so login/signup work on the domain.
