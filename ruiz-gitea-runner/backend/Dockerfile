# Extract act_runner binary from the official image
FROM gitea/act_runner:latest AS act

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime
FROM node:20-alpine
WORKDIR /app

# act_runner needs git, bash, and Docker CLI for running jobs
RUN apk add --no-cache git bash curl docker-cli

# Copy act_runner binary (try multiple locations from the act image root)
COPY --from=act / /act_from_act
RUN set -euo pipefail \
  && if [ -f /act_from_act/act_runner ]; then \
       cp /act_from_act/act_runner /usr/local/bin/act_runner; \
     elif [ -f /act_from_act/usr/local/bin/act_runner ]; then \
       cp /act_from_act/usr/local/bin/act_runner /usr/local/bin/act_runner; \
     elif [ -f /act_from_act/usr/bin/act_runner ]; then \
       cp /act_from_act/usr/bin/act_runner /usr/local/bin/act_runner; \
     else \
       echo "act_runner binary not found in gitea/act_runner image" >&2; exit 1; \
     fi \
  && chmod +x /usr/local/bin/act_runner \
  && rm -rf /act_from_act

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
