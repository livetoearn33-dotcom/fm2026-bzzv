# JS Bridge 契約（原生 ↔ WebView）

> **v2（2026-09-04）：改成沿用 Vincent 分支上已經在跑的命名。** v1 自創了一套 `EQNative` / `EQ.*`，跟既有實作對不上，已作廢。
> 原則：**已經寫好並測過的那邊是基準**，另一邊配合。

## 命名規則（沿用既有）

| 方向 | 怎麼呼叫 | 出處 |
|---|---|---|
| 網頁 → 原生 | `Android.方法名(...)` | `addJavascriptInterface(OverlayJsBridge(), "Android")`，已在 `EQAccessibilityService.kt` |
| 原生 → 網頁 | `window.on事件名(...)` | 既有的 `window.onScreenshotAttached(path)` 就是這個形式 |

原生打進網頁一律用 `evaluateJavascript`，網頁端每個 callback 都要先判斷存在再呼叫（原生已經是這樣寫的）。

---

## 一、網頁 → 原生：`Android.*`

### 已經做好的（Vincent 分支上就有）

```js
Android.replaceDraft(text)     // 把 text 寫進宿主 App 的輸入框（覆蓋原內容）
Android.attachScreenshot()     // 截這一次的畫面，完成後回呼 window.onScreenshotAttached(path)
```

**`replaceDraft` 一支就夠用**——代寫的「填入」跟防自爆的「換成這句」做的是同一件事：把輸入框的字換掉。不用再開第二個方法。

### 要新增的（四支，都很短）

```js
Android.setPersona(id)         // 使用者點角色 chip：id ∈ zhuge | ceo | charmer
                               // 原生重打一次 /analyze 帶 persona，結果照樣走 onAnalyzeResult
Android.closeOverlay()         // 收起浮層 / 收起建議條
Android.extractKnowledge(input, kind)   // kind ∈ "text" | "url"，原生打 POST /v1/extract
Android.confirmKnowledge(itemsJson)     // 使用者確認後寫入，原生逐筆打 PUT /v1/facts/{id} 或 /v1/contacts/{id}
```

---

## 二、原生 → 網頁：`window.on*`

### 已經做好的

```js
window.onScreenshotAttached(path)   // 截圖完成
```

### 要新增的

```js
window.onState(state)
// state ∈ "idle" | "loading" | "filled"
// 網頁自己決定畫面怎麼演，原生不用管狀態機

window.onAnalyzeResult(json)
// 後端 /analyze 的回應，原樣轉傳不加工：
// { risk, riskReason, reply, plainReply?, naiveReply, sources: [{id,label}] }

window.onGuardResult(json)
// 後端 /guard 的回應，原樣轉傳，另外把使用者的草稿原文一起帶上：
// { flagged, type, reason, spans: [{start,end,label}], suggestion, draft }
// flagged 為 false 時不用呼叫，直接 onState("idle")

window.onKnowledgeList(json)     // { facts: [...], contacts: [...] }
window.onKnowledgeDrafts(json)   // /extract 的回應：{ extracted, items[] } 或 { extracted:false, reason }
window.onKnowledgeSaved(count)   // 寫入成功筆數

window.onError(code)
// code ∈ "no_conversation" | "network" | "server" | "fill_failed"
```

---

## 三、三個容易踩的地雷

1. **`spans` 是草稿原文的字元索引**（0 起算、含頭不含尾）。傳給網頁前**不要 trim、不要改字**，索引會歪。`draft` 也要原樣附上，網頁靠它標記。
2. **`replaceDraft` 之後畫面不會自己收**。等原生確認寫入成功再呼叫 `window.onState("filled")`；寫入失敗呼叫 `window.onError("fill_failed")`，讓使用者知道要自己複製。
3. **payload 原樣轉傳**。後端回什麼就丟什麼進來，原生不要重新組物件——欄位名一改，網頁就讀不到。

---

## 四、頁面對應

| 頁面 | 檔案 | 跑在哪 | 用到的事件 |
|---|---|---|---|
| 代寫 | `design/app-writing.html` | 浮層 WebView | `onState`、`onAnalyzeResult`、`onError`；回呼 `replaceDraft`、`setPersona`、`closeOverlay` |
| 防自爆 | `design/app-selfburn.html` | IME 建議條 WebView | `onState`、`onGuardResult`；回呼 `replaceDraft`、`closeOverlay` |
| 知識庫 | `design/app-settings.html` | App 內設定頁 WebView | `onKnowledgeList`、`onKnowledgeDrafts`、`onKnowledgeSaved`、`onError`；回呼 `extractKnowledge`、`confirmKnowledge` |

**HTML 檔要放進 `app/src/main/assets/`**（既有的 `overlay_bridge_test.html` 就在那）。建議 build 時從 `design/` 自動複製，不然視覺改一次就要手搬一次。

---

## 五、沒有原生環境時自動退回假資料

每個頁面底部都有這段（已內建，不要刪）：

```js
if (!window.Android) {
  window.Android = {
    replaceDraft: (t) => console.log("[mock] replaceDraft:", t),
    attachScreenshot: () => console.log("[mock] attachScreenshot"),
    setPersona: (id) => console.log("[mock] setPersona:", id),
    closeOverlay: () => {},
    extractKnowledge: (i, k) => console.log("[mock] extract:", k, i),
    confirmKnowledge: (j) => console.log("[mock] confirm:", j)
  };
  // 並自動跑一次內建 demo 資料，讓畫面有東西看
}
```

所以 **雙擊 HTML 就能看完整流程**，不需要 App、不需要後端、不需要網路。設計端可以獨立迭代，demo 現場任何一環壞掉也能退回這個模式跑完。

---

## 六、誰負責什麼

| 事 | 誰 |
|---|---|
| `window.on*` 的實作（畫面怎麼演） | 前端 HTML |
| `Android.*` 的實作 | Vincent（兩支已完成，四支待補） |
| payload 內容正確性 | Brian（後端原樣回傳） |
| 契約有爭議 | 找 Zeno，不要各自解讀 |
