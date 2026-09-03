# 後端部署映像（Zeabur / 任何 Docker 平台）
# 放在 repo 根目錄，因為後端要讀 ../data 與 ../prompts；Root Directory 請設為 repo 根目錄。
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY backend/ ./
RUN pnpm build && pnpm prune --prod

FROM node:22-alpine
WORKDIR /app/backend
ENV NODE_ENV=production \
    PORT=8080 \
    LOG_LEVEL=info \
    DATA_DIR=/app/data \
    PROMPTS_DIR=/app/prompts
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY backend/package.json ./
COPY data/ /app/data/
COPY prompts/ /app/prompts/
EXPOSE 8080
CMD ["node", "dist/src/main.js"]
