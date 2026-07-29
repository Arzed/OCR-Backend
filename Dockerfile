FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json yarn.lock ./
COPY prisma ./prisma/
RUN yarn install --frozen-lockfile --ignore-engines
COPY . .
RUN npx prisma generate
RUN yarn build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json yarn.lock ./
COPY prisma ./prisma/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

CMD ["sh", "-c", "npx prisma db push && node dist/main"]
