# Build TypeScript
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Runtime: Node.js + QEMU (Debian-based node:20-slim image)
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    qemu-system-x86 qemu-utils genisoimage ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/index.js"]
