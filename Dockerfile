# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
RUN npm run build
RUN npx prisma generate

FROM base AS production
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma
COPY openapi.yaml ./openapi.yaml
RUN npm prune --omit=dev
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.js"]
