# JS Bridge 契約（原生 ↔ WebView）

> 給 Vincent（Android 殼）與前端。UI 本體是 `design/app-*.html`，跑在 WebView 裡；原生只負責取得資料、傳進來、接住使用者動作。
> 命名規則好記：**`window.EQ.*` 是原生打進網頁**，**`window.EQNative.*` 是網頁打回原生**。

## 三個頁面

| 頁面 | 檔案 | 跑在哪 |
|---|---|---|
| 代寫 | `design/app-writing.html` | 浮層 WebView |
| 防自爆 | `design/app-selfburn.html` | IME 建議條 WebView |
| 知識庫 | `design/app-settings.html` | App 內設定頁 WebView |

## 通則

1. **原生注入用 `evaluateJavascript`**：`webView.evaluateJavascript("EQ.render(" + json + ")", null)`
2. **網頁回傳用 `addJavascriptInterface`**：介面名固定 `EQNative`
3. **所有 payload 是 JSON**，欄位對齊 `prompts/README-組裝說明.md` 的 API 契約，原生只做轉傳不做加工
4. **沒有原生環境時自動退回內建假資料**：每個頁面開頭都判斷 `window.EQNative` 存不存在，不存在就用內建 demo 資料跑。**這樣設計師在瀏覽器裡雙擊就能繼續做，不用等 App**——也是 demo 出事時的降級路徑
5. **原生不需要理解狀態機**：叫 `EQ.setState()` 和 `EQ.render()` 就好，畫面怎麼演是網頁的事

---

## 一、代寫（app-writing.html）

### 原生 → 網頁

```js
EQ.setState("idle")        // 待命
EQ.setState("loading")     // 已按附加，等後端
EQ.render({                // 後端 /analyze 的回應，原樣轉傳
  risk: "pressure",
  riskReason: "他已經問第二次 · 要的是有人接住",
  reply: "收到，我確認一下進度——今晚 8 點前補完整版給您確認。目前卡在客戶端還沒回簽，已經在追。",
  plainReply: "（選填，帶 persona 時才有）",
  naiveReply: "收到",
  sources: [{ id: "proj-a-status", label: "A 案進度" }]
})
EQ.error("no_conversation")  // 或 "network" | "server"
```

### 網頁 → 原生

```js
EQNative.fill(text)       // 使用者按「填入」：把 text 寫進宿主 App 的輸入框
EQNative.persona(id)      // 使用者點角色 chip：id ∈ zhuge | ceo | charmer，原生重打一次 /analyze 帶 persona
EQNative.close()          // 收起浮層
```

**`fill` 之後畫面不自己收**——等原生確認寫入成功再呼叫 `EQ.setState("filled")`。寫入失敗就 `EQ.error("fill_failed")`，讓使用者知道要自己複製。

---

## 二、防自爆（app-selfburn.html）

### 原生 → 網頁

```js
EQ.setState("idle")        // 高度 0，不佔位
EQ.setState("checking")    // 已送 /guard，等回應（畫面不變，避免閃爍）
EQ.render({                // 後端 /guard 的回應，原樣轉傳
  flagged: true,
  type: "defensive",
  reason: "他讀起來會像被推回去自己想辦法",
  spans: [{ start: 0, end: 12, label: "防禦" }],
  suggestion: "這個價格包含 A、B、C。如果預算有考量，我們也有 Y 方案可以談。",
  draft: "我們的品質跟別人不一樣，你可以去比較看看。"
})
```

**`draft` 必須原樣附上。** `spans` 是草稿原文的字元索引（0 起算、含頭不含尾），網頁要靠它標記；原生不可以 trim 或改字，索引會歪。

`flagged: false` 時直接 `EQ.setState("idle")`，不要呼叫 render。

### 網頁 → 原生

```js
EQNative.replace(text)    // 使用者按「換成這句」：用 text 取代輸入框全部內容
EQNative.dismiss()        // 使用者按「照我的送」：收起建議條，同一段草稿不再提醒
```

---

## 三、知識庫（app-settings.html）

### 原生 → 網頁

```js
EQ.renderList({ facts: [...], contacts: [...] })   // 進頁面時載入現況（GET /v1/facts、/v1/contacts）
EQ.renderDrafts({                                   // /extract 的回應
  extracted: true,
  items: [ { type, label, tags, content, updatedAt, volatility, usage, internalReason } ]
})
EQ.renderDrafts({ extracted: false, reason: "這個連結我讀不到內容，可以直接把文字貼給我" })
EQ.saved(count)                                     // 寫入成功，count 是成功筆數
EQ.error("network")
```

### 網頁 → 原生

```js
EQNative.extract(input, kind)   // kind ∈ "text" | "url"，原生打 POST /v1/extract
EQNative.confirm(itemsJson)     // 使用者確認後寫入，原生逐筆打 PUT /v1/facts/{id} 或 /v1/contacts/{id}
EQNative.back()                 // 離開設定頁
```

**`internalReason` 不寫進資料庫**——它只是給使用者看的說明，`confirm` 時網頁已經丟掉它，原生不用處理。

**`usage: "internal"` 的開關狀態以網頁送回來的為準**，不是 LLM 判定的那個——使用者可能改過。

---

## 開發用的假資料模式

每個頁面底部都有這段（已內建，不要刪）：

```js
if (!window.EQNative) {
  window.EQNative = {
    fill: (t) => console.log("[mock] fill:", t),
    persona: (id) => console.log("[mock] persona:", id),
    replace: (t) => console.log("[mock] replace:", t),
    extract: (i, k) => console.log("[mock] extract:", k, i),
    confirm: (j) => console.log("[mock] confirm:", j),
    close: () => {}, dismiss: () => {}, back: () => {}
  };
  // 並自動跑一次內建 demo 資料，讓畫面有東西看
}
```

所以：**雙擊 HTML 就能看完整流程，不需要 App、不需要後端、不需要網路。** 設計端可以獨立迭代，demo 現場任何一環壞掉也能退回這個模式跑完。

---

## 誰負責什麼

| 事 | 誰 |
|---|---|
| `EQ.*` 的實作（畫面怎麼演） | 前端 HTML |
| `EQNative.*` 的實作（Android 端） | Vincent |
| payload 的內容正確性 | Brian（後端原樣回傳，原生不加工） |
| 這份契約有爭議 | 找 Zeno，不要各自解讀 |
