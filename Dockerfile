FROM node:22-alpine AS base
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# deps
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --include=dev --legacy-peer-deps

# builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

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

CMD ["node", "server.js"]
