# Build context: repo root (Railway uses RAILWAY_DOCKERFILE_PATH=packages/mcp-server/Dockerfile
# so it can locate this Dockerfile after the service rootDirectory was reset).
# All COPY paths are repo-root-relative; do not invoke `docker build` from
# packages/mcp-server — it must be run from the repo root.
FROM node:22-slim
WORKDIR /app
COPY packages/mcp-server/package.json packages/mcp-server/tsconfig.json ./
COPY packages/mcp-server/src/ ./src/
RUN npm install
RUN npx tsc
RUN npm prune --omit=dev
EXPOSE 8080
CMD ["node", "dist/http.js"]
