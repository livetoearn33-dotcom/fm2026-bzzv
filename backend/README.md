# Hono Open API Starter

一個用於建構完整文件化、型別安全 JSON API 的起始範本，採用 Hono 框架與 OpenAPI 規範。

## 特色

- **型別安全路由** - 使用 [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) 確保請求/回應結構的型別正確性
- **互動式 API 文件** - 透過 [Scalar](https://scalar.com/) 自動生成 API 文件
- **結構化日誌** - 整合 [Pino](https://getpino.io/) 提供高效能日誌系統
- **型別單一來源** - 從 [Drizzle](https://orm.drizzle.team/) Schema 推導所有型別，搭配 [drizzle-zod](https://orm.drizzle.team/docs/zod) 整合
- **DDD 分層架構** - 功能優先組織搭配 Domain/Service/Repository 分層
- **依賴注入** - 工廠函式模式，易於測試與擴展

## 技術棧

| 類別 | 技術 |
|------|------|
| 框架 | [Hono](https://hono.dev/) |
| 執行環境 | Node.js ([@hono/node-server](https://hono.dev/docs/getting-started/nodejs)) |
| 資料庫 | PostgreSQL ([pg](https://node-postgres.com/) + [Drizzle ORM](https://orm.drizzle.team/)) |
| 驗證 | [Zod](https://zod.dev/) v4 |
| 測試 | [Vitest](https://vitest.dev/) |
| Linting | [@antfu/eslint-config](https://github.com/antfu/eslint-config) |

## 快速開始

```bash
# 複製範本
npx degit w3cj/hono-open-api-starter my-api
cd my-api

# 建立環境變數
cp .env.example .env

# 安裝依賴
pnpm install

# 推送資料庫 Schema
pnpm drizzle-kit push

# 啟動開發伺服器
pnpm dev
```

## 常用指令

```bash
pnpm dev          # 啟動開發伺服器 (hot reload)
pnpm build        # 編譯 TypeScript
pnpm start        # 執行編譯後的程式
pnpm test         # 執行測試
pnpm typecheck    # 型別檢查
pnpm lint         # 程式碼檢查
pnpm lint:fix     # 自動修正 lint 問題
```

## 專案結構

```
src/
├── app.ts                    # 應用程式入口與 DI 組裝
├── main.ts                   # 伺服器啟動
├── features/                 # 功能模組 (DDD 分層)
│   └── {feature}/
│       ├── api/              # 路由、處理器、測試
│       ├── domain/           # 實體、Repository 介面
│       ├── services/         # 業務邏輯
│       ├── repositories/     # 資料存取實作
│       ├── types/            # 型別定義 (從 Schema 推導)
│       ├── db/               # Drizzle Schema
│       └── validation/       # Zod Schema
├── shared/                   # 共用模組
│   ├── db/                   # 資料庫客戶端
│   ├── errors/               # 錯誤類別
│   ├── middleware/           # 中介軟體
│   ├── types/                # 共用型別
│   └── utils/                # 工具函式
└── lib/                      # 應用程式工具
    ├── create-app.ts         # App 工廠
    └── configure-open-api.ts # OpenAPI 設定
```

## API 端點

| 路徑 | 說明 |
|------|------|
| `GET /doc` | OpenAPI 規格文件 |
| `GET /reference` | Scalar API 文件介面 |
| `GET /v1/tasks` | 列出所有任務 |
| `POST /v1/tasks` | 建立任務 |
| `GET /v1/tasks/{id}` | 取得單一任務 |
| `PATCH /v1/tasks/{id}` | 更新任務 |
| `DELETE /v1/tasks/{id}` | 刪除任務 |

## 新增功能模組

1. 在 `/src/features/` 建立新目錄
2. 依照 DDD 分層建立子目錄 (`api/`, `domain/`, `services/`, `repositories/`, `types/`, `db/`, `validation/`)
3. 在 `db/schema.ts` 定義 Drizzle Schema
4. 從 Schema 推導型別至 `types/index.ts`
5. 在 `domain/` 定義 Repository 介面
6. 實作 Repository 與 Service (使用工廠函式)
7. 定義路由與處理器
8. 在 `app.ts` 進行 DI 組裝並註冊路由

參考 `/src/features/task/` 作為範例。

## 參考資源

- [Hono 文件](https://hono.dev/)
- [Drizzle ORM 文件](https://orm.drizzle.team/)
- [Zod OpenAPI 範例](https://hono.dev/examples/zod-openapi)
- [OpenAPI 規範](https://swagger.io/docs/specification/v3_0/about/)
- [Scalar API 文件](https://github.com/scalar/scalar)

## 授權

MIT
