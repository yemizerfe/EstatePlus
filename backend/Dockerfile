# syntax=docker/dockerfile:1.7

# ── Dependencies + Prisma client ─────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Prisma's query engine needs OpenSSL; argon2 may need to compile on install.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

# ── TypeScript build ────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ── Runtime ─────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs expressjs

# Copy the schema before installing so @prisma/client's postinstall can find it.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

# Use the client generated in the deps stage so it matches the schema exactly.
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma

COPY --from=build /app/dist ./dist

# Avatars are written here at runtime; compose mounts a named volume over it.
RUN mkdir -p uploads/avatars && chown -R expressjs:nodejs /app
USER expressjs

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Migrations run on every boot and are idempotent, so a fresh volume and an
# existing one behave the same.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/index.js"]

# Optional out-of-process background worker (docker compose --profile workers).
FROM runner AS worker
CMD ["node", "dist/workers/index.js"]
