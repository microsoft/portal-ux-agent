# Multi-stage build for Portal UX Agent
FROM node:20-slim AS builder
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && mkdir -p dist/data && cp -R src/data/. dist/data/

# Production image
FROM node:20-slim AS runner
WORKDIR /app

# Only runtime deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist
# Static assets for runtime (CSS/JS)
COPY public ./dist/public

ENV NODE_ENV=production \
    UI_PORT=3000 \
    MCP_PORT=3001

EXPOSE 3000 3001

CMD ["node", "dist/start-combined.js"]
