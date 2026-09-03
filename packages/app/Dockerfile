# Multi-stage build for production deployment
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install production dependencies
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Ensure scripts directory and startup script are executable
RUN chmod +x /app/scripts/start-production.sh || echo "Startup script not found, creating fallback"

# Generate Prisma client (if needed)
# RUN npx prisma generate

# Build both frontend and backend
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Install dependencies for runtime (removed build tools since we don't need to rebuild native modules)
# postgresql-client provides pg_dump and psql for database backups
RUN apk add --no-cache wget postgresql-client

# Create app user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/vite.config.ts ./vite.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/sql_dump ./sql_dump
COPY --from=builder /app/certs ./certs
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/public ./public
# COPY --from=builder /app/scripts ./scripts (directory doesn't exist)

# REMOVED: npm rebuild bcrypt --build-from-source (this was causing the architecture conflict)
# REMOVED: apk del python3 make g++ (no longer needed since we're not rebuilding native modules)

# Copy exports directory if it exists (optional)
RUN mkdir -p ./exports

# Copy SSL directory (create instead of copy since it doesn't exist)
# COPY --from=builder /app/ssl ./ssl (directory doesn't exist)

# Create uploads, logs, ssl, and backups directories (fallback for local development)
RUN mkdir -p /app/uploads /app/logs /app/ssl /app/backups && chown nodejs:nodejs /app/uploads /app/logs /app/backups

# Create all directories that the application might need at runtime
RUN mkdir -p /app/client/public/assets /app/client/public/downloads /app/public/uploads /app/public/downloads && \
  chown -R nodejs:nodejs /app/client /app/public /app/uploads /app/logs /app/ssl

# Make scripts executable (script doesn't exist, skipping)
# RUN chmod +x /app/scripts/start-production.sh

# Set permissions
USER nodejs

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DOCKER_CONTAINER=true

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Push Drizzle schema on startup (ensures all tables/columns exist), then start the app
CMD ["sh", "-c", "npx drizzle-kit push --force && npm start"] 