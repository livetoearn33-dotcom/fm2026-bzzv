# 知識庫 schema 說明

> 架構承襲巡聲（海巡引擎）知識層，欄位精簡到 48 小時用得完的程度。
> 內容規則（Zeno 2026-09-02 核定）：**真實資料去識別化**——結構、數字量級、語氣保真；人名、品牌名、案名換掉。repo 會開源，這裡的每一筆都會永久公開。

## facts.json — 事實庫

| 欄位 | 必填 | 說明 | 承襲自巡聲 |
|---|---|---|---|
| `id` | ✓ | 英文 kebab-case，回覆的 sources 用它對映 | id |
| `label` | ✓ | 顯示名，來源標籤直接顯示這個（「2026 標準報價」） | name |
| `tags` | ✓ | 粗篩用關鍵字陣列 | topics |
| `content` | ✓ | 事實本文，AI 只能引用這裡面寫的 | fact |
| `updatedAt` | ✓ | 最後查證日 | verified_at |
| `volatility` | ✓ | `high`（報價、進度、檔期——會過期）／`low`（規格、方案內容——穩定）。high 的事實引用時建議帶日期口吻 | volatility |
| `usage` |  | 引用限制。**`internal` = AI 可以參考、絕不能寫進回覆**（例：折扣底線）。省略 = 可引用 | usage |

`usage: "internal"` 是 demo 亮點：知識庫裡放一筆「底價可讓到 X」，AI 回覆時知道有談判空間、但永遠只寫「有其他方案可以談」——知道但不說。

## contacts.json — 對象檔案

照 spec 原 schema：`id`、`name`、`role`、`tone`（語氣偏好）、`notes`（註記）、`recentTopics`。
組裝時整筆注入第 4 層〈本次任務〉，位階高於 Zeno 語氣預設。

## 目前狀態

兩個 json 都是**骨架＋demo 必要筆**：demo 兩幕用到的已寫好（與 golden path 對齊），其餘標 `_TODO` 前綴的是等 Zeno 口述真實資料後補的洞。`_TODO` 筆在後端粗篩時要跳過（Brian：判 id 開頭）。
目標量：facts 10–20 筆、contacts 4–6 筆。
