# Use Node.js LTS as the base image for building
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create production image with OpenStudio
FROM nrel/openstudio:3.7.0

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create directories
RUN mkdir -p ./templates ./measures ./temp

# Copy templates directory if it exists
COPY templates ./templates

# Copy measures directory if it exists
COPY measures ./measures

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV OPENSTUDIO_CLI_PATH=/usr/local/openstudio-3.7.0/bin/openstudio
ENV PORT=3000
ENV HOST=0.0.0.0
ENV BCL_MEASURES_DIR=/app/measures
ENV LOG_LEVEL=info

# Create volume for persistent data
VOLUME ["/app/measures", "/app/temp"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the application
CMD ["node", "dist/index.js"]