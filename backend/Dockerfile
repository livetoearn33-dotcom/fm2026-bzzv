# 後端部署映像（Zeabur / 任何 Docker 平台）
#
# 這份檔案在 repo 根目錄與 backend/Dockerfile 各放一份，內容必須完全一致
# （backend/src/shared/assets-sync.test.ts 會檢查兩份相同）。原因：Zeabur
# 目前的實際行為是「一律用 repo 根目錄的 Dockerfile」，但 build context
# 可能是 repo 根目錄，也可能只給 backend/ 子目錄——兩種情況都要能 build。
#
# 判斷邏輯：
# - build context 是 repo 根目錄 → /src 底下同時有 backend/ 與 data/、prompts/。
# - build context 是 backend/   → /src 本身就是 backend 的內容，並且已經
#   由 `pnpm sync:assets` 把 data/、prompts/ 複製進 backend/assets/ 並 commit
#   進 git（見 backend/scripts/sync-assets.mjs），所以 /src/assets 一定在。

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /src
COPY . /src

# 找出後端專案根目錄：repo-root context 時是 /src/backend，
# backend-dir context 時就是 /src 自己。
RUN if [ -f /src/backend/package.json ]; then \
      echo "/src/backend" > /tmp/app-dir; \
    elif [ -f /src/package.json ]; then \
      echo "/src" > /tmp/app-dir; \
    else \
      echo "找不到 backend 的 package.json（/src/backend/package.json 或 /src/package.json 都不存在）" >&2; \
      exit 1; \
    fi

RUN APP="$(cat /tmp/app-dir)" \
 && echo "== app dir: $APP ==" \
 && cd "$APP" \
 && pnpm install --frozen-lockfile \
 && pnpm build \
 && pnpm prune --prod

# 資產目錄：repo-root context 用 /src/data、/src/prompts 這個真源；
# backend-dir context 用 $APP/assets/data、$APP/assets/prompts 這個副本。
RUN APP="$(cat /tmp/app-dir)" \
 && if [ -d /src/data ] && [ -d /src/prompts ]; then \
      echo "/src/data" > /tmp/data-dir; \
      echo "/src/prompts" > /tmp/prompts-dir; \
    else \
      echo "$APP/assets/data" > /tmp/data-dir; \
      echo "$APP/assets/prompts" > /tmp/prompts-dir; \
    fi

# 整理成固定路徑，方便 runtime stage 用同一組 COPY --from=build 指令，
# 不用管究竟是哪一種 build context。順便在 log 裡列出來，部署平台漏掉
# 目錄時這一步會直接爆炸而不是留到 runtime 才發現。
RUN APP="$(cat /tmp/app-dir)" \
 && DATA_DIR="$(cat /tmp/data-dir)" \
 && PROMPTS_DIR="$(cat /tmp/prompts-dir)" \
 && mkdir -p /out/app /out/assets/data /out/assets/prompts \
 && cp -r "$APP/node_modules" /out/app/node_modules \
 && cp -r "$APP/dist" /out/app/dist \
 && cp "$APP/package.json" /out/app/package.json \
 && cp -r "$DATA_DIR"/. /out/assets/data/ \
 && cp -r "$PROMPTS_DIR"/. /out/assets/prompts/ \
 && echo "== /out/app ==" && ls -la /out/app \
 && echo "== /out/assets/data ==" && ls -la /out/assets/data \
 && echo "== /out/assets/prompts ==" && ls -la /out/assets/prompts \
 && test -f /out/assets/data/facts.json \
 && test -f /out/assets/data/contacts.json \
 && test "$(ls /out/assets/prompts | wc -l)" -gt 0

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    LOG_LEVEL=info \
    DATA_DIR=/app/assets/data \
    PROMPTS_DIR=/app/assets/prompts
COPY --from=build /out/app/ /app/
COPY --from=build /out/assets/ /app/assets/
EXPOSE 8080
CMD ["node", "dist/src/main.js"]
