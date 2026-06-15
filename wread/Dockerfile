# WRead Dockerfile - Single container for self-hosted deployment
FROM node:22-slim AS dependencies
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@11.1.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/wread-app/package.json ./apps/wread-app/
COPY patches/ ./patches/
COPY packages/ ./packages/
RUN --mount=type=cache,id=pnpm,sharing=locked,target=/pnpm/store pnpm install --frozen-lockfile
RUN test -f packages/foliate-js/vendor/pdfjs/annotation_layer_builder.css \
    && test -d packages/simplecc-wasm/dist/web \
    || { printf '\nERROR: Required git submodules are not initialized.\nRun: git submodule update --init packages/foliate-js packages/simplecc-wasm\n\n'; exit 1; }
RUN pnpm --filter @readest/readest-app setup-vendors

FROM node:22-slim AS development-stage
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@11.1.1
WORKDIR /app
COPY --from=dependencies /app /app
COPY . .
WORKDIR /app/apps/wread-app
# Create data directories
RUN mkdir -p /app/data/storage
EXPOSE 3000
ENTRYPOINT ["pnpm", "dev-web", "-H", "0.0.0.0"]

FROM node:22-slim AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@11.1.1
WORKDIR /app
ARG NEXT_PUBLIC_APP_PLATFORM=web
COPY --from=dependencies /app/node_modules /app/node_modules
COPY --from=dependencies /app/apps/wread-app/node_modules /app/apps/wread-app/node_modules
COPY --from=dependencies /app/apps/wread-app/public/vendor /app/apps/wread-app/public/vendor
COPY --from=dependencies /app/packages/foliate-js/node_modules /app/packages/foliate-js/node_modules
COPY . .
WORKDIR /app/apps/wread-app
RUN pnpm build-web

FROM node:22-slim AS production-stage
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@11.1.1
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/wread-app
# Create data directories for persistent storage
RUN mkdir -p /app/data/storage
EXPOSE 3000
ENTRYPOINT ["pnpm", "start-web", "-H", "0.0.0.0"]
