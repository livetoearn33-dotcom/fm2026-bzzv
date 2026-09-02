# Android Handoff — EQ Copilot

## 1. 這一側已完成什麼

Android 端目前已完成一個可工作的 **Gboard + Accessibility + WebView Overlay shell**。

核心目的不是自製輸入法，而是保留使用者原本的 Gboard 中文／注音輸入，同時在鍵盤上方提供 EQ Copilot 建議條，讓 App 可以：

- 讀取使用者正在輸入的 draft
- 在停止輸入約 180 ms 後取得 stable draft
- 顯示／隱藏並定位 WebView 建議條
- 將建議文字直接「替換」回目前輸入框
- 使用者按「附加」時擷取目前 App window screenshot
- 讓 WebView 與 Android native 雙向溝通

目前 demo target 是 **Nekogram**：

```text
tw.nekomimi.nekogram
```

核心 Android 邏輯集中在：

```text
app/src/main/java/com/eqcopilot/app/EQAccessibilityService.kt
```

WebView 測試頁目前是：

```text
app/src/main/assets/overlay_bridge_test.html
```

這個 HTML 只是 bridge / interaction 驗證頁，之後應替換成 UI 組的正式 HTML/CSS/JS。

---

## 2. Runtime 架構

```text
                Gboard
                  │
                  ▼
        Nekogram editable field
                  │
                  ▼
        EQAccessibilityService
          │        │        │
          │        │        └─ screenshot current app window
          │        │
          │        └─ ACTION_SET_TEXT replace draft
          │
          └─ observe draft + 180 ms debounce
                  │
                  ▼
          WebView suggestion overlay
                  │
          ┌───────┴────────┐
          ▼                ▼
       /guard           /analyze
     [待 CTO 串]       [待 CTO 串]
          │                │
          └───────┬────────┘
                  ▼
          UI 顯示 AI 建議
```

EQ Copilot 本身就是 Android App。最終使用者只需要安裝 build 出來的 APK，並開啟 Accessibility 權限；實際文字輸入仍然使用 Gboard。

---

## 3. 預期操作邏輯

### A. 防自爆 / Guard

使用者正常在 Nekogram 用 Gboard 打字：

```text
使用者輸入
→ Accessibility 收到 draft change
→ debounce 180 ms
→ stable draft
→ 呼叫 /guard
→ backend 回傳風險與建議
→ WebView 顯示提醒
→ 使用者決定是否按「替換」
```

Android 端現在已經完成：

```text
輸入 → stable draft → WebView
```

CTO 最適合在 `EQAccessibilityService.kt` 的 stable draft 流程串入 `/guard`。

建議 backend request 至少包含：

```json
{
  "draft": "目前使用者輸入的文字"
}
```

若 backend 需要目前對話、使用者知識庫或其他 context，可在 integration layer 再補。

**重要：** `/guard` 之後要處理 stale response。  
例如 draft 已從 A 變成 B，A 的較慢 response 回來時不能覆蓋 B 的 UI。建議用 request id / draft hash / sequence number 驗證 response 是否仍然有效。

---

### B. 代寫 / Analyze

使用者主動按 UI 的「附加」：

```text
WebView
→ Android.attachScreenshot()
→ EQAccessibilityService.captureCurrentWindow()
→ takeScreenshotOfWindow(...)
→ 儲存為 app cache JPEG
→ 呼叫 /analyze
→ backend 分析 screenshot + KB
→ 回傳建議回覆
→ WebView 顯示候選
→ 使用者按「替換」
```

screenshot 目前會存在 App private cache，例如：

```text
/data/user/0/com.eqcopilot.app/cache/latest_capture.jpg
```

建議 `/analyze` 的上傳在 **Android native integration layer** 處理，而不是要求 WebView 自己讀這個 private file path。

---

### C. 替換文字

正式互動是 **替換／填入，不自動送出訊息**。

目前已完成：

```text
WebView
→ Android.replaceDraft(text)
→ AccessibilityNodeInfo.ACTION_SET_TEXT
→ Nekogram editable field
```

替換成功後 Android 也會重新同步實際 draft，避免 UI state 與輸入框不一致。

---

## 4. WebView ↔ Android 現有 bridge

WebView 透過：

```javascript
Android.replaceDraft(text)
Android.attachScreenshot()
```

呼叫 Android native。

Android 目前會向 WebView 發送：

```javascript
window.onNativeDraftChanged(draft)
window.onScreenshotAttached(path)
window.onScreenshotError(message)
```

UI 組替換 `overlay_bridge_test.html` 時，建議保留以上 interface contract。

Backend 接進來後，建議另外新增類似：

```javascript
window.onGuardResult(result)
window.onAnalyzeResult(result)
```

實際 JSON schema 可由 CTO / frontend 一起定義。

---

## 5. CTO 最適合串接的位置

### `/guard`

入口：

```text
EQAccessibilityService
→ onDraftChanged(...)
→ debounce 完成 / stable draft
```

在 stable draft 產生後：

```text
stable draft
→ ApiClient.guard(...)
→ response
→ WebView evaluateJavascript(...)
```

不要在每一個 raw keystroke 都打 API；目前已有 180 ms debounce。

### `/analyze`

入口：

```text
OverlayJsBridge.attachScreenshot()
→ captureCurrentWindow(...)
→ Result<String> screenshotPath
```

在 screenshot success 後：

```text
path
→ 讀取 JPEG
→ ApiClient.analyze(...)
→ response
→ WebView
```

### UI

正式 UI 直接替換：

```text
app/src/main/assets/overlay_bridge_test.html
```

或調整 `loadUrl(...)` 指向新的 asset entry HTML。

Android overlay 的顯示、隱藏、位置計算不需要 UI 組重新處理。

---

## 6. Android 行為與權限

Accessibility service 需要：

```text
canRetrieveWindowContent = true
canTakeScreenshot = true
flagRetrieveInteractiveWindows
```

目前 overlay 使用：

```text
TYPE_ACCESSIBILITY_OVERLAY
```

並會：

- 偵測 `TYPE_INPUT_METHOD`
- Gboard 出現時顯示建議條
- Gboard 消失時隱藏建議條
- 動態取得 IME top position
- 將 overlay 放在 Gboard 上方並保留小間距

draft 目前針對 Nekogram editable node 處理，package name 是 hardcoded demo target：

```text
tw.nekomimi.nekogram
```

若後續要支援 Telegram / LINE / WhatsApp，應把 package filtering 抽成 configurable supported-app list，而不是直接散落 hardcode。

---

## 7. 目前已驗證

目前 Android demo 已實際驗證：

- Gboard 注音／中文輸入正常
- Nekogram draft 可被 Accessibility 讀取
- 已存在的 draft 在重新 focus 時可同步
- draft 可 debounce 後同步至 WebView
- WebView overlay 只在鍵盤出現時顯示
- overlay 會定位在 Gboard 上方
- WebView 可替換 Nekogram draft
- 「附加」可擷取目前 App window screenshot
- screenshot 不包含 EQ Copilot 自己的 Accessibility overlay
- screenshot 可儲存到 App cache 並把結果回傳至 WebView

主要驗證環境：

```text
Pixel 9 Pro emulator
Android 16 / API 36
Gboard
Nekogram
```

---

## 8. 目前尚未完成、由整合端接手

Android capability 已完成，接下來主要是 integration：

1. `/guard` API client
2. `/analyze` screenshot upload
3. backend response schema
4. backend result → WebView callback
5. 正式 UI HTML/CSS/JS 替換測試頁
6. request cancellation / stale response protection
7. loading / timeout / backend error state
8. 若要支援 Nekogram 以外 App，抽出 package filtering

建議先不要重構 Accessibility 核心，先完成 end-to-end：

```text
Gboard draft
→ /guard
→ UI
→ replace

附加 screenshot
→ /analyze
→ UI
→ replace
```

這兩條跑通後，再做 cleanup / abstraction。

---

## 9. 最短 Smoke Test

整合後每次 build 至少驗證：

```text
1. 開 Nekogram conversation
2. 點輸入框 → Gboard 出現
3. EQ overlay 出現在 Gboard 上方
4. 打中文 → UI 收到最新 stable draft
5. /guard 回覆能顯示
6. 按替換 → 輸入框文字被正確替換
7. 按附加 → screenshot 成功
8. /analyze 回覆能顯示
9. 收起 Gboard → EQ overlay 隱藏
```

如果以上全部通過，Android → backend → frontend 的主流程就完成。
