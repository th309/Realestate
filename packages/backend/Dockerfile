# Multi-stage Dockerfile for NestJS backend with Python ML support
# Build context is repo root (specified in railway.json)

# Stage 1: Build Node.js application
FROM node:20-slim AS builder

WORKDIR /app/packages/backend

# Copy package files from backend
COPY packages/backend/package*.json ./

# Install Node.js dependencies
RUN npm ci

# Copy backend source code
COPY packages/backend/ ./

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:20-slim

# Install Python 3 and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create symlinks for python/pip commands
RUN ln -sf /usr/bin/python3 /usr/bin/python && \
    ln -sf /usr/bin/pip3 /usr/bin/pip

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/node_modules ./node_modules
COPY --from=builder /app/packages/backend/package*.json ./

# Copy Python requirements and install
COPY packages/backend/requirements.txt ./
RUN pip install --no-cache-dir --break-system-packages -r requirements.txt

# Copy Python ML scripts (accessible at runtime for spawning)
COPY propertyiq-ml ./propertyiq-ml

# Set environment variables
ENV NODE_ENV=production
ENV PYTHON_PATH=/usr/bin/python3
ENV ML_SCRIPTS_PATH=/app/propertyiq-ml

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "dist/main.js"]
