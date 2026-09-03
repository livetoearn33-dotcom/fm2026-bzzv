# fm2026-bzzv Backend

Hackathon 用後端：Hono + Vercel AI SDK，知識庫直接讀 `data/*.json`，不用資料庫。

## API

| 路徑                       | 說明                                                          |
| -------------------------- | ------------------------------------------------------------- |
| `POST /v1/analyze`         | 讀空氣：判斷輸入訊息的風險與建議回應                          |
| `POST /v1/guard`           | 防自爆：偵測地雷話術並給出警戒訊號                            |
| `POST /v1/persona`         | 角色改寫：依角色卡改寫語氣                                    |
| `GET /v1/contacts`         | 列出全部對象檔案（不含 `_TODO` 骨架筆）                       |
| `PUT /v1/contacts/{id}`    | 新增或更新一筆對象檔案（body 不含 id）                        |
| `DELETE /v1/contacts/{id}` | 刪除一筆對象檔案，不存在回 404                                |
| `GET /v1/facts`            | 列出全部事實庫（不含 `_TODO` 骨架筆）                         |
| `PUT /v1/facts/{id}`       | 新增或更新一筆事實（body 不含 id；省略 updatedAt 補今天日期） |
| `DELETE /v1/facts/{id}`    | 刪除一筆事實，不存在回 404                                    |
| `GET /health`              | 服務存活檢查                                                  |
| `GET /doc`                 | OpenAPI 規格文件                                              |
| `GET /reference`           | Scalar 互動式 API 文件頁                                      |

知識庫寫入是 write-through：PUT／DELETE 立刻寫回 `DATA_DIR` 下的 `contacts.json`／`facts.json`（先寫暫存檔再 rename），`/analyze`、`/guard` 的檢索也會立刻讀到最新內容，不用重啟服務。

Demo 劇本句子走 golden path 快取，其餘走 LLM（見 `src/shared/golden-path/`）。

## 環境變數

複製 `.env.example` 為 `.env` 後填入：

| 變數             | 說明                                                     |
| ---------------- | -------------------------------------------------------- |
| `OPENAI_API_KEY` | OpenAI API 金鑰（必填）                                  |
| `OPENAI_MODEL`   | 使用的 chat 模型，預設 `gpt-5-mini`                      |
| `DATA_DIR`       | `data/*.json` 所在目錄，選填，預設 repo 根目錄的 `data/` |
| `PROMPTS_DIR`    | prompts 所在目錄，選填，預設 repo 根目錄的 `prompts/`    |
| `PORT`           | 伺服器埠號，預設 `9999`                                  |
| `LOG_LEVEL`      | 日誌等級，預設 `debug`                                   |

## 指令

```bash
pnpm dev          # 啟動開發伺服器 (hot reload)
pnpm test         # 執行測試
pnpm typecheck    # 型別檢查
pnpm lint         # 程式碼檢查
```

## Golden Path

Demo 劇本句子命中預先寫好的 `src/shared/golden-path/*.ts` 對照表時直接回傳固定結果，其餘輸入才呼叫 LLM。

## 部署

Zeabur（或任何 Docker 平台）一律用 repo 根目錄的 `Dockerfile`；Root Directory 設 `backend` 或留空都可以——這份 Dockerfile 會自動判斷 build context 是 repo 根目錄還是 `backend/` 子目錄，兩種都能 build 出一樣的服務（`backend/Dockerfile` 是同一份檔案的副本，兩者需保持一致）。

- build context 是 repo 根目錄：直接讀 `data/`、`prompts/` 真源。
- build context 只有 `backend/`：讀 `backend/assets/data`、`backend/assets/prompts`（`data/`、`prompts/` 的副本，見 `scripts/sync-assets.mjs`）。

**改了 `data/` 或 `prompts/` 之後，一定要跑 `pnpm sync:assets` 並把 `backend/assets/` 的變動一併 commit**，否則：

1. `backend/` 子目錄 context 部署時讀到舊資料。
2. `pnpm test` 會紅（`src/shared/assets-sync.test.ts` 會逐檔比對 `assets/` 與來源是否一致）。
