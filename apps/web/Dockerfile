# apps/web/Dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/

FROM base AS deps
RUN pnpm install --frozen-lockfile

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# For Next.js, copy the built workspace
COPY --from=build /app ./

RUN chown -R node:node /app
USER node

EXPOSE 3000
WORKDIR /app/apps/web
CMD ["pnpm", "start"]