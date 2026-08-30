FROM node:22-alpine AS base
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache libc6-compat

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN pnpm db:generate

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_KPI_AUTH_URL
ARG NEXT_PUBLIC_KPI_APP_ID
ARG NEXT_PUBLIC_POSTHOG_TOKEN
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_POSTHOG_ASSETS_HOST

ARG NEXT_PUBLIC_GIT_SHA
ARG NEXT_PUBLIC_GIT_REPO
ARG NEXT_PUBLIC_GITHUB_RUN_ID
ARG NEXT_PUBLIC_BUILD_TIME
ARG NEXT_PUBLIC_DOCKER_IMAGE
ARG NEXT_PUBLIC_DOCKER_TAG

ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_KPI_AUTH_URL=${NEXT_PUBLIC_KPI_AUTH_URL} \
    NEXT_PUBLIC_KPI_APP_ID=${NEXT_PUBLIC_KPI_APP_ID} \
    NEXT_PUBLIC_POSTHOG_TOKEN=${NEXT_PUBLIC_POSTHOG_TOKEN} \
    NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST} \
    NEXT_PUBLIC_POSTHOG_ASSETS_HOST=${NEXT_PUBLIC_POSTHOG_ASSETS_HOST} \
    NEXT_PUBLIC_GIT_SHA=${NEXT_PUBLIC_GIT_SHA} \
    NEXT_PUBLIC_GIT_REPO=${NEXT_PUBLIC_GIT_REPO} \
    NEXT_PUBLIC_GITHUB_RUN_ID=${NEXT_PUBLIC_GITHUB_RUN_ID} \
    NEXT_PUBLIC_BUILD_TIME=${NEXT_PUBLIC_BUILD_TIME} \
    NEXT_PUBLIC_DOCKER_IMAGE=${NEXT_PUBLIC_DOCKER_IMAGE} \
    NEXT_PUBLIC_DOCKER_TAG=${NEXT_PUBLIC_DOCKER_TAG} \
    CI=true

RUN --mount=type=cache,id=nextjs-cache,target=/app/.next/cache \
    pnpm build

FROM scratch AS static-export
COPY --from=builder /app/.next/static /_next/static

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
