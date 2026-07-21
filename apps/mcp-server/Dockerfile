FROM node:22-alpine

RUN apk add --no-cache sqlite \
    && npm install -g pnpm@10.15.0

WORKDIR /app

# Dependency layer (Docker layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json ./
COPY apps/mcp-server/package.json ./apps/mcp-server/
COPY packages/core/package.json ./packages/core/
COPY packages/core/pnpm-lock.yaml ./packages/core/
RUN pnpm install

# Source + build
COPY . .
RUN pnpm build

# Default memory root
ENV MYMORE_ROOT=/root/.mymore

CMD ["node", "apps/mcp-server/dist/bootstrap.js"]
