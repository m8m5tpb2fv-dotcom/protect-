# ───── build ─────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
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
# migrations are idempotent; run them on start, then serve
CMD ["sh", "-c", "npx tsx --conditions=react-server scripts/migrate.ts && npx next start -p ${PORT}"]
