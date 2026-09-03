# 文件索引

幕聊 EQ Copilot ｜ FUTUREMODE × SITCON BUILDMODE Hackathon 2026

## 從哪讀起

| 想知道 | 讀這份 |
|---|---|
| 這個產品要演什麼、每一格畫面長什麼樣 | [demo-script.md](demo-script.md) ← **所有東西的上游**，功能沒出現在這裡就不是這次的優先項 |
| 架構、API 契約、定案表（含決策日期） | [spec.md](spec.md) |
| prompt 怎麼分層、後端怎麼組裝 | [../prompts/README-組裝說明.md](../prompts/README-組裝說明.md) |
| 知識庫的欄位與資料規則 | [../data/README-知識庫.md](../data/README-知識庫.md) |
| 引擎測過了沒、測出什麼 | [../tests/dry-run-報告-2026-09-03.md](../tests/dry-run-報告-2026-09-03.md) |
| 視覺為什麼這樣做 | [../design/REFINE-NOTES.md](../design/REFINE-NOTES.md) |

## 這個資料夾裡有什麼

| 檔案 | 是什麼 |
|---|---|
| [demo-script.md](demo-script.md) | Demo 敘事與逐格畫面狀態。上游文件 |
| [spec.md](spec.md) | 架構、三個機制、API 契約、五個畫面、定案表 |
| [qa-彈藥.md](qa-彈藥.md) | 評審提問的備用答案（資安、產品定位、技術實作、可行性） |
| [ui-brief.md](ui-brief.md) | 視覺方向包與 AI 味檢查清單 |
| [claude-design-playbook.md](claude-design-playbook.md) | 本專案的設計工作手冊 |
| [refs-overlay.md](refs-overlay.md) | 浮層卡片的設計參考調研 |
| [refs-suggestion-bar.md](refs-suggestion-bar.md) | 鍵盤建議條的設計參考調研 |
| [refs-multi-surface.md](refs-multi-surface.md) | 雙 surface 一致性的設計參考調研 |
| [screenshot-shopping-list.md](screenshot-shopping-list.md) | 設計參考的截圖採買清單 |

## 其他資料夾

| 路徑 | 內容 |
|---|---|
| `prompts/` | 三個引擎 prompt、語氣層、範例庫、三張角色卡、組裝契約。**這裡是 prompt 的唯一真源，後端讀檔組裝** |
| `data/` | `facts.json` 事實庫、`contacts.json` 對象檔案 |
| `backend/` | Hono 後端，`/analyze`、`/guard`、`/persona`、`/extract`、知識庫 CRUD |
| `EQCopilot/` | Android 原生殼 |
| `design/` | WebView UI 本體與設計原型，全部離線可跑（字型已打包在 `design/fonts/`） |
| `tests/` | Prompt 引擎的 dry-run 靶子測試報告 |
