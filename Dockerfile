# ───── build ─────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* are inlined at build time; Railway passes service variables as build args.
ARG NEXT_PUBLIC_APP_NAME NEXT_PUBLIC_APP_URL NEXT_PUBLIC_DEFAULT_CITY NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_MAP_PROVIDER NEXT_PUBLIC_YANDEX_MAPS_API_KEY NEXT_PUBLIC_YANDEX_SUGGEST_API_KEY NEXT_PUBLIC_2GIS_API_KEY RAILWAY_PUBLIC_DOMAIN
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ───── runtime ─────
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN groupadd -r app && useradd -r -g app app && mkdir -p /app/storage && chown app:app /app/storage
COPY --from=build --chown=app:app /app ./
USER app
EXPOSE 3000
# migrations + idempotent seed on start, then serve (see scripts/start.sh)
CMD ["sh", "scripts/start.sh"]
