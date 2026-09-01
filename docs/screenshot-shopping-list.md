# 截圖採買清單

要餵給 Claude Design 第 2 段（靈感）用的。照這張清單去截圖就好，不用自己找。

三份完整調研在 [refs-overlay.md](refs-overlay.md)、[refs-suggestion-bar.md](refs-suggestion-bar.md)、[refs-multi-surface.md](refs-multi-surface.md)。

---

## 優先級 A：現在就能開、直接截

| # | 開這裡 | 截什麼 | 解決我們的哪一題 |
|---|---|---|---|
| 1 | [Raycast DESIGN.md](https://styles.refero.design/style/3b6a17f0-3bdf-418c-a95e-0b89e5a8b2f8) | 邊框與陰影那段的 hex 數值 | **浮層邊界怎麼在不用重陰影的情況下分離**。做法是 hairline 邊框＋inset 內陰影取代 drop-shadow |
| 2 | [Perplexity Citations 拆解](https://aiuxplayground.com/teardowns/perplexity/citations/) | 來源 chip 貼在句尾的處理 | **「引用：A 案進度」標籤怎麼掛才不像按鈕**。做法是來源名優先、超過就 +N 收合 |
| 3 | [PatternFly Expandable Section](https://www.patternfly.org/components/expandable-section/design-guidelines/) | **錄成動圖**，這個可以真的點開互動 | 收合／展開的動態 |
| 4 | [Grammarly 語氣建議](https://www.grammarly.com/blog/tone-suggestions/) | 紫色語氣底線，**跟紅色拼字、藍色文法對照著看** | 風險詞標記的顏色要跟「錯字」區分開。用紅色會被讀成「你打錯了」 |
| 5 | [Grammarly 手機語氣偵測器](https://www.grammarly.com/blog/product/tone-detector-mobile/) | 點 G 圖示跳出的語氣說明 | **「提醒不是錯誤」的語氣**。它用「聽起來很樂觀」這種描述效果的說法，跳出紅／灰二選一的框架 |
| 6 | [SwiftKey Copilot Tone](https://support.microsoft.com/en-us/topic/how-to-use-tone-in-microsoft-swiftkey-keyboard-5acbf805-e28c-41f6-8028-be405758f34a) | 工具列的完整展開流程 | 形態最接近的參考，就是鍵盤上方那條 |

---

## 優先級 B：要裝軟體或自己實測

這幾個查不到公開可開的畫面，但值得花時間：

- **Raycast**（Mac）— 浮層本體的實際手感，光看 DESIGN.md 感覺不出來
- **SwiftKey**（Android）— Tone 工具列的實際像素稿。**不要用文字描述去猜色碼**
- **Grammarly Keyboard**（Android）— 手機鍵盤上的語氣偵測實際長怎樣
- Arc Little Arc、Superhuman command bar、Notion AI inline、Alfred、Spotlight — 都要裝了才看得到

---

## 不用去的地方

- **Awwwards、Godly、Landbook** — 那些是行銷網頁的視覺，跟工作工具的調性反向

---

## 兩個要注意的時效問題

- **Grammarly 已於 2025 更名 Superhuman，招牌綠退場。** 拿它當參考可以（它的互動邏輯還是最成熟的），但不要當成演進中的標竿
- **Arc 已進維護模式**，同上

---

## 餵圖時搭配的 prompt

```
這幾張是我心中的參考。請分析它們的共通點：版面留白、資訊密度、對比方式、圓角與陰影的使用、字級層級。

然後用同樣的視覺語言重新優化我的兩個介面。

特別注意：
- 浮層是浮在別的 App 上面的東西，邊界要清楚，但不要用重陰影或發光（參考 Raycast 用 hairline 邊框加 inset 內陰影的做法）
- 資訊密度要高但不擁擠——使用者是在工作中被打斷的狀態，要能一眼掃完
- 主要內容是「一段 AI 產生的回覆文字」，它應該是畫面上唯一的主角
- 建議條上的提醒語氣要像 Grammarly 那樣「描述效果」而不是「標示對錯」——說「對方看到可能會…」而不是「這句有風險」
- 風險詞的標記顏色要跟「錯字」明確區分，不要用紅色
```
