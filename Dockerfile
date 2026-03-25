FROM node:22-alpine AS base
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# deps
FROM base AS deps
RUN apk add --no-cache libc6-compat

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN pnpm db:generate

# builder
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_KPI_AUTH_URL
ARG NEXT_PUBLIC_KPI_APP_ID

ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_KPI_AUTH_URL=${NEXT_PUBLIC_KPI_AUTH_URL} \
    NEXT_PUBLIC_KPI_APP_ID=${NEXT_PUBLIC_KPI_APP_ID} \
    CI=true

RUN --mount=type=cache,id=nextjs-cache,target=/app/.next/cache \
    pnpm build

# runner
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/next.config.ts ./next.config.ts

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
