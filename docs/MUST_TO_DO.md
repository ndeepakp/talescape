# MUST-TO-DO (before / during any infra migration)

A running list of things we **must** address before or while moving Talerooms to
new infrastructure (e.g. AWS, GCP, or any non-Fly host). Treat these as
release-blockers for a migration, not "nice to haves".

---

## 1. Move file storage off the local disk → S3-compatible object storage

**Priority: HIGH — do this before, or as the first step of, any migration.**

### The problem
Today every uploaded file — **avatars, story covers, (planned) chapter images,
feed wallpapers** — is written to the **local Fly volume** (`public/uploads`,
served via the `/uploads/[...path]` route). That disk is:

- **Pinned to one machine** — not portable; a migration can't just "lift and
  shift" it cleanly.
- **Single-node, no CDN** — slower global delivery, no edge caching.
- **Fragile** — if the volume is lost/recreated, the files are gone (the DB
  cascade does not cover on-disk files).

So the moment we change hosts, all of this binary data has to be migrated by
hand, and any host that doesn't offer the same persistent-volume semantics
breaks us.

### What we must NOT do
- **Never store image/file bytes in Postgres.** The DB should only ever hold the
  object **key/URL**, never the binary (blobs bloat the DB, wreck backup/restore
  times, and are slow to serve).

### The target architecture
- Store all files in **S3-compatible object storage**. Recommended:
  **Cloudflare R2** (S3-native API, very cheap, **zero egress fees** — important
  when serving lots of images). AWS S3 or GCS (S3-compat mode) also work; all
  speak the same API, so the choice stays swappable.
- Put all file I/O behind **one small storage adapter** — `put(key, bytes)`,
  `url(key)`, `delete(key)` — so the rest of the app never knows the provider.
  Migrating providers then = change an endpoint + credentials + which adapter is
  instantiated. No data-model change, no app rewrite.
- The DB continues to store only URLs/keys (as it does now).
- The local volume becomes a dev/fallback convenience, not the production store.

### Migration checklist
- [ ] Introduce the S3-compatible storage adapter (interface + one
      implementation).
- [ ] Route **avatars**, **covers**, **wallpapers**, and **chapter images**
      through the adapter (replaces the direct `public/uploads` writes).
- [ ] Provision a bucket + credentials (4 secrets:
      endpoint, key, secret, bucket).
- [ ] One-time backfill: copy existing `public/uploads/*` into the bucket and
      rewrite stored URLs if needed.
- [ ] Confirm the `beforeDelete` cleanup (avatars/wallpapers) also deletes from
      object storage.
- [ ] Decommission reliance on the Fly volume for uploads.

### Why it's worth the small upfront tax
Setting up object storage now is a bit more work than writing to the volume
(a bucket + a few secrets), but it's the difference between a **config-change
migration** and a **painful, hand-rolled data move** later.

---

## 2. Make money real — replace the mock payment layer

**Priority: HIGHEST (existential) — before any real launch or growth push.**

Talerooms is a marketplace, but **no actual money moves** yet — purchases,
subscriptions and earnings all run through a mock layer. Until this is real we
can't validate the core thesis (will readers pay?), pay creators, or call
ourselves a business. This is the scariest, most-regulated piece, so it needs
real planning, not a quick hack:

- Integrate a real payment processor (e.g. Stripe) for one-off chapter/story
  purchases **and** recurring author subscriptions.
- Creator payouts (Stripe Connect or similar), fees/tax handling, refunds,
  receipts, and a webhook-driven source of truth for entitlements.
- Replace the mock purchase/subscription flows and reconcile existing
  `access_grants` / `subscriptions` data.

---

## 3. Pre-launch hardening (do these before scaling)

Small but non-negotiable before a public push:

- **Object storage** — see item 1; get uploads off the local disk first.
- **Chapter images** — let stories embed pictures (reusable for everyone; the
  gateway to the Kids vertical). Build on top of object storage, never store
  bytes in Postgres. Design for **multiple images per chapter** from day one.
- **Email verification** — finish the parked signup email-verification flow
  (better-auth supports it; needs a real email provider wired in). Table stakes
  for a trustworthy signup.

---

_Add new must-do migration items below as we discover them._
