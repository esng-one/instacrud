# Base dependencies
FROM node:22-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build stage
FROM base AS builder
WORKDIR /app
COPY . .

# Required at build time (Next.js public env)
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

ENV NEXT_TELEMETRY_DISABLED=1

# Fail fast if not provided
RUN if [ -z "$NEXT_PUBLIC_API_BASE_URL" ]; then \
      echo "ERROR: NEXT_PUBLIC_API_BASE_URL must be provided at build time"; \
      exit 1; \
    fi

RUN echo "build-time NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL"
RUN npm run build

# Runtime image
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Non-root user
RUN addgroup -S app && adduser -S app -G app
USER app

# Copy standalone output
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

# Start Next.js standalone server directly
CMD ["node", "server.js"]