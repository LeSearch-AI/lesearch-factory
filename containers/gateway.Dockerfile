# LeSearch gateway — slim bun image running the control plane + serving the WebUI.
FROM oven/bun:1.3-slim

WORKDIR /app

# Install workspace deps first (better layer caching)
COPY package.json bun.lock* ./
COPY packages/proto/package.json packages/proto/
COPY packages/core/package.json packages/core/
COPY packages/gateway/package.json packages/gateway/
RUN bun install --frozen-lockfile || bun install

# App source
COPY packages/proto packages/proto
COPY packages/core packages/core
COPY packages/gateway packages/gateway
COPY packages/webui packages/webui
COPY schemas schemas

EXPOSE 7700
CMD ["bun", "run", "packages/gateway/src/serve.ts"]
