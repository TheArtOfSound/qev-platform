FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
COPY connectors ./connectors
COPY flows ./flows
COPY schemas ./schemas
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @imagineqira/qev-shared build \
 && pnpm --filter @imagineqira/qev-core build \
 && pnpm --filter @imagineqira/qev-event-schema build \
 && pnpm --filter @imagineqira/qev-policy-engine build \
 && pnpm --filter @imagineqira/qev-evidence-bundle build \
 && pnpm --filter @imagineqira/qev-sdk build \
 && pnpm --filter @imagineqira/qev-gateway build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app /app
RUN mkdir -p /data/packages
EXPOSE 7443
CMD ["node", "apps/gateway/dist/index.js"]
