# Multi-stage build for production deployment
FROM --platform=linux/amd64 node:18-alpine AS base

# Install dependencies only when needed
FROM --platform=linux/amd64 base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# Rebuild the source code only when needed
FROM --platform=linux/amd64 base AS builder
WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Generate Prisma client (if needed)
# RUN npx prisma generate

# Build the frontend only
RUN npx vite build

# Production image, copy all the files and run the app
FROM --platform=linux/amd64 base AS runner
WORKDIR /app

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
COPY --from=builder /app/sql_dump ./sql_dump
COPY --from=builder /app/exports ./exports

# Copy AWS RDS SSL certificate
COPY --from=builder /app/ssl/rds-ca-2019-root.pem /app/ssl/rds-ca-2019-root.pem

# Create uploads, logs, and ssl directories (fallback for local development)
RUN mkdir -p /app/uploads /app/logs /app/ssl && chown nodejs:nodejs /app/uploads /app/logs

# Set permissions
USER nodejs

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"] 