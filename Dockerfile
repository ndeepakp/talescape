# syntax=docker/dockerfile:1
# Production image for Talerooms (Next.js standalone output).
# Debian "slim" base (not Alpine) so native deps — sharp, onnxruntime-node — get
# prebuilt glibc binaries instead of having to compile against musl.

# 1) Install dependencies against a clean lockfile.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) Build the app. Produces .next/standalone (a self-contained server) plus
#    .next/static. Uses the webpack builder (npm run build) because the Turbopack
#    builder mis-traces better-auth's unused SQLite dialects.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3) Minimal runtime: just Node + the standalone bundle, run as non-root.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
