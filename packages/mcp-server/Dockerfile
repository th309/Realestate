# PropertyIQ MCP Server (Railway)
# Build context: monorepo root. Railway service must have an empty
# "Root Directory" setting and "Dockerfile Path" = packages/mcp-server/Dockerfile
# so this Dockerfile can COPY sibling workspace packages (analyzer-core, etc.).

FROM node:22-slim AS base

WORKDIR /app

# 1. Install monorepo dependencies — cached unless any package.json or the lockfile changes.
COPY package.json package-lock.json ./
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/analyzer-core/package.json ./packages/analyzer-core/
# Postinstall script referenced by root package.json; type stub it touches must exist too
COPY scripts/postinstall-fix-types.js ./scripts/
COPY packages/frontend/types/ ./packages/frontend/types/
# Sibling workspace package.jsons are required so `npm ci` can resolve the
# workspaces graph; their source is not copied here (kept out of cache key).
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/emails/package.json ./packages/emails/
COPY packages/video-template/package.json ./packages/video-template/

RUN npm ci

# 2. Copy source for the packages we actually build, then build analyzer-core
# first because mcp-server imports its compiled dist/.
COPY packages/analyzer-core/ ./packages/analyzer-core/
COPY packages/mcp-server/ ./packages/mcp-server/

RUN npm run build -w @propertyiq/analyzer-core \
    && npm run build -w @propertyiq/mcp-server

EXPOSE 8080
CMD ["node", "packages/mcp-server/dist/http.js"]
