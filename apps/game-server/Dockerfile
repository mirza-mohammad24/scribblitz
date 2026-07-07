# apps/game-server/Dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# Copy the monorepo structural files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
# Copy Prisma schema
COPY prisma/ prisma/
# Copy the shared packages and the specific app
COPY packages/ packages/
COPY apps/game-server/ apps/game-server/

# Install dependencies for the whole workspace
FROM base AS deps
RUN pnpm install --frozen-lockfile

# Build the game-server and its local dependencies
FROM deps AS build
# Generate Prisma client before building
RUN pnpm dlx prisma generate
RUN pnpm --filter game-server build

# Create the final, lightweight runner image
FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=build /app/apps/game-server/dist ./apps/game-server/dist
COPY --from=build /app/apps/game-server/package.json ./apps/game-server/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/prisma ./prisma

RUN chown -R node:node /app
USER node

EXPOSE 3001
WORKDIR /app/apps/game-server
CMD ["node", "dist/server.js"]