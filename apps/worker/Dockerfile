FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# Copy the monorepo structural files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
# Copy the shared packages and the specific app
COPY packages/ packages/
COPY apps/worker/ apps/worker/

# Install dependencies for the whole workspace
FROM base AS deps
RUN pnpm install --frozen-lockfile

# Build the worker and its local dependencies
FROM deps AS build
# Build the shared packages first so the worker can find them
RUN pnpm --filter "./packages/**" run --if-present build
# Build the worker
RUN pnpm --filter worker build

# Create the final runner image
FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

# Copy the ENTIRE built workspace so pnpm symlinks stay perfectly intact
COPY --from=build /app ./

RUN chown -R node:node /app
USER node

# Note: Background workers do not need an EXPOSE directive because they don't accept incoming HTTP requests!
WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]