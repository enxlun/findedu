# Node 22.18+ runs TypeScript directly (type stripping), so there is no build step.
FROM node:22-slim
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production PORT=8080
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY ui/package.json ui/
RUN pnpm install --frozen-lockfile --prod
COPY erxes.json ./
COPY api/src api/src
COPY ui ui
EXPOSE 8080
HEALTHCHECK CMD node -e "fetch('http://localhost:8080/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "api/src/main.ts"]
