# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install build dependencies for native modules
# - libc6-compat: for glibc compatibility
# - python3, make, g++: for node-gyp (native modules like pdf-parse)
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
# Using npm install as fallback in case package-lock.json is out of sync
RUN npm ci || npm install

# ============================================
# Stage 2: Build the application
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code and config files
COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# ============================================
# Stage 3: Production runtime
# ============================================
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install runtime dependencies
# - libc6-compat: for glibc compatibility
# - openssl: required by Prisma
RUN apk add --no-cache libc6-compat openssl

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy package files
COPY package.json package-lock.json ./

# Install ONLY production dependencies
RUN (npm ci --omit=dev || npm install --omit=dev) && \
    npm cache clean --force

# Copy Prisma schema and entrypoint script
COPY prisma ./prisma
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Change ownership to non-root user
RUN chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Expose the application port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Use entrypoint script for safety (Prisma generation, etc.)
ENTRYPOINT ["./docker-entrypoint.sh"]

# Start the application using compiled JS for better performance
CMD ["node", "dist/server.js"]
