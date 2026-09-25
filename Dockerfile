# ----------------------------------------------------
# Base Stage
# ----------------------------------------------------
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install openssl for Prisma native engine support
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ----------------------------------------------------
# Dependencies Stage
# ----------------------------------------------------
FROM base AS dependencies
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ----------------------------------------------------
# Build Stage
# ----------------------------------------------------
FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

# Generate Prisma Client and build NestJS production bundle
RUN pnpm prisma generate
RUN pnpm build

# Prune devDependencies for lean production output
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm prune --prod

# ----------------------------------------------------
# Production Runner Stage (AWS App Runner / Cloud Ready)
# ----------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy minimal required files to run
COPY package.json pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Non-root user for security best practice
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs nestjs
RUN chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
