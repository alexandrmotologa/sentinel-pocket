# Stage 1: Build React Telegram Mini App
FROM node:22-alpine AS web-builder
WORKDIR /app/web
COPY web/package.json web/.npmrc ./
RUN npm install
COPY web/ ./
RUN npm run build

# Stage 2: Build Node.js TypeScript Backend
FROM node:22-alpine AS server-builder
WORKDIR /app/server
COPY server/package.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# Stage 3: Minimal Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/sentinel_pocket.db

RUN apk add --no-cache dumb-init

# Copy server dependencies and install production-only packages
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev

# Copy compiled backend from builder
COPY --from=server-builder /app/server/dist ./dist

# Copy compiled frontend from web-builder
WORKDIR /app
COPY --from=web-builder /app/web/dist ./web/dist

# Create persistent storage folder for SQLite
RUN mkdir -p /data && chown -R node:node /data /app

USER node
WORKDIR /app/server

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/src/index.js"]
