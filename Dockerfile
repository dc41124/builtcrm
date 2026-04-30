# syntax=docker/dockerfile:1.7

# ---------- Stage 1: install deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps: better-auth@1.6.9 peer-requires drizzle-orm@^0.45.2
# but the app pins 0.41.0; older npm resolution accepted this, newer
# npm requires the flag. The lock file was regenerated with the same
# flag, so this matches the local install.
#
# We do NOT pass --omit=optional. lightningcss ships its platform-
# specific native binaries (lightningcss.linux-x64-musl.node, etc.) as
# optional deps; Tailwind v4's postcss plugin requires the matching
# binary at build time, so omitting optional breaks `next build`.
RUN npm ci --legacy-peer-deps

# ---------- Stage 2: build ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Render injects env vars at build time too — `src/lib/env.ts` zod
# validation runs during `next build` and would throw without them.
RUN npm run build

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone output bundles only what's needed
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
