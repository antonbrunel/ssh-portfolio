FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Non-root user for security
RUN addgroup -S portfolio && adduser -S portfolio -G portfolio

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# keys/ is created at runtime — must be writable by the app user
RUN mkdir -p keys && chown portfolio:portfolio keys

USER portfolio

EXPOSE 2222

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD nc -z localhost 2222 || exit 1

CMD ["node", "dist/server.js"]
