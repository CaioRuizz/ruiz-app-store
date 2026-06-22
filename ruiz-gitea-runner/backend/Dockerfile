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

# Copy act_runner binary
COPY --from=act /act_runner /usr/local/bin/act_runner
RUN chmod +x /usr/local/bin/act_runner

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
