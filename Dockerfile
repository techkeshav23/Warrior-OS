# syntax=docker/dockerfile:1
# ─── Warrior OS — production image (Next.js 16 standalone) ───
# Multi-stage: install deps, build, then a slim runtime that runs the
# standalone server. NEXT_PUBLIC_SITE_URL is baked at build time (it is a
# NEXT_PUBLIC_* value), so Coolify passes it as a build arg.

FROM node:22-alpine AS base
# libc compat for any native optional deps (e.g. Next's image tooling).
RUN apk add --no-cache libc6-compat

# ─── deps: install with the lockfile ───
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ─── builder: compile the app ───
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public origin, needed at build time for link-preview (og:image) URLs.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── runner: minimal runtime ───
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
# Standalone server + assets only.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
