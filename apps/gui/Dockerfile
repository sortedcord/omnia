FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
WORKDIR /app

FROM base AS build-deps
RUN apt-get update -qq && \
    apt-get install -qq -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json tsconfig.json tsconfig.base.json ./
COPY apps/gui/package.json apps/gui/package.json
COPY apps/gui/tsconfig.json apps/gui/tsconfig.json
COPY apps/gui/next.config.ts apps/gui/next.config.ts
COPY apps/gui/postcss.config.mjs apps/gui/postcss.config.mjs
COPY apps/gui/components.json apps/gui/components.json
COPY packages/actor/package.json packages/actor/package.json
COPY packages/architect/package.json packages/architect/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/intent/package.json packages/intent/package.json
COPY packages/llm/package.json packages/llm/package.json
COPY packages/memory/package.json packages/memory/package.json
COPY packages/scenario/package.json packages/scenario/package.json
COPY packages/spatial/package.json packages/spatial/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM build-deps AS builder
COPY . .
RUN pnpm build
RUN pnpm --filter @omnia/gui build

FROM base AS runner
ENV NODE_ENV=production
RUN apt-get update -qq && \
    apt-get install -qq -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/gui/package.json \
    /app/apps/gui/next.config.ts \
    /app/apps/gui/postcss.config.mjs \
    ./apps/gui/
COPY --from=builder /app/apps/gui/.next ./apps/gui/.next
COPY --from=builder /app/apps/gui/public ./apps/gui/public

WORKDIR /app/apps/gui
EXPOSE 3000
CMD ["pnpm", "start"]
