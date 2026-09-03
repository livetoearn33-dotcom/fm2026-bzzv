# 鍵盤建議條（防自爆建議條）視覺參考採買清單

給負責畫面 3「鍵盤建議條」的設計師／餵 Claude Design 用。只負責**貼緊鍵盤上緣、收合 56dp／展開 160dp 的建議條**這個 surface，不含浮層卡片與跨 surface 視覺一致性（那是另外兩組的範圍）。

用法：每一筆給網址＋要看哪個畫面／哪一段＋解決哪個設計問題＋具體怎麼解的。截圖時直接點連結進去看對應段落，不用整頁翻。事實與推測有分開標——我自己沒有帳號登入實測的地方，都寫「未親眼確認」。

---

## 設計問題 1：極窄空間裡的提示條（56dp 要放提示文字＋一個動作）

### 1. iOS QuickType 預測列
- 網址：https://appleinsider.com/articles/14/09/26/how-to-customize-hide-or-remove-quicktype-suggestions-with-the-ios-8-keyboard
- 看哪裡：文中截圖，鍵盤正上方那一整條窄列，三個候選詞並排
- 怎麼解的：單行、三等分欄位，文字置中，沒有多餘裝飾。極限窄空間下靠「等分＋單行文字」而不是圖示來塞資訊。**推測**：這個三等分結構本身很難塞下一句完整提醒＋一個動作按鈕，所以幕聊的建議條大概率要在版面上跟 QuickType 拉開差異（例如左文右鈕，而不是三等分）
- 事實／推測：畫面描述是**事實**（多篇報導一致），版面對幕聊的適用性判斷是**推測**

### 2. Gboard 建議列（含 Smart Compose／剪貼簿建議）
- 網址：https://support.google.com/gboard/answer/7068415
- 看哪裡：官方支援頁的功能說明段落，描述建議列同一條列位在不同情境下切換內容（單字候選 / 完整句子補全 / 剪貼簿貼上按鈕）
- 怎麼解的：**同一個 56dp 高度的容器承載完全不同的內容類型**，靠圖示＋文字對齊規則統一觀感，而不是靠固定內容結構。這點對幕聊很關鍵：待命／觸發／展開三態內容差很多，Gboard 證明同一條可以切換內容種類而不違和
- 事實／推測：功能描述是**事實**（官方文件）；具體切版面細節未親眼確認實機

### 3. SwiftKey Copilot／Tone 工具列
- 網址：https://support.microsoft.com/en-us/topic/how-to-use-tone-in-microsoft-swiftkey-keyboard-5acbf805-e28c-41f6-8028-be405758f34a
- 看哪裡：頁面步驟截圖，鍵盤上方那條窄列上的 Copilot 圖示，點下去才展開選項
- 怎麼解的：收合時只放一個圖示（不放文字），把「說明」延後到點擊後才出現。這是應對 56dp 空間最保守的解法——**先只給一個可辨識的觸發點，內容留到展開層**。可以對照參考：如果 56dp 塞不下「一行提示＋動作」，退而求其次先放「一個信號＋隱含的可展開提示」
- 事實／推測：介面存在與操作流程是**事實**（官方支援頁）；視覺精確樣式（顏色、圖示大小）未親眼確認，另有 Windows Central 的實測截圖描述可對照：https://www.windowscentral.com/software-apps/a-new-ai-feature-for-microsofts-android-swiftkey-keyboard-makes-you-look-like-a-great-writer-without-actually-being-one

---

## 設計問題 2：「提醒」而不是「錯誤」的視覺語氣（紅色太重、灰色太弱）

### 4. Grammarly Keyboard App 語氣偵測器（手機版）
- 網址：https://www.grammarly.com/blog/product/tone-detector-mobile/（官方發表文）與 https://www.xda-developers.com/grammarly-tone-detector-available-keyboard-app/（第三方圖文報導）
- 看哪裡：文中說明「點鍵盤上的綠色 G 圖示，跳出用 emoji 表示語氣的說明」這段
- 怎麼解的：**完全不用紅色警示，改用 emoji＋描述性文字**（例如「聽起來很樂觀」）傳達「這句話讀起來怎樣」而不是「這句話錯了」。這是解「提醒 vs 錯誤」語氣問題最直接的先例——用「描述效果」取代「標示錯誤」的措辭策略，幕聊的一行提示可以參考這個角度（例如寫「這句可能讓對方縮手」而不是「語氣有誤」）
- 事實／推測：功能與措辭邏輯是**事實**（官方部落格）；實際畫面顏色與版面未親眼確認，Google Play 上的截圖能看到但本次未能開圖驗證

### 5. Chrome 密碼儲存提示條（infobar／omnibox bubble）
- 網址：https://www.chromium.org/user-experience/infobars/
- 看哪裡：頁面對 infobar 設計原則的文字說明（「一行放得下訊息＋控制項＋關閉鈕」「不要打斷使用者」）
- 怎麼解的：這是「系統級中性提醒」的教科書案例——**灰／白底、無警示色、放在使用者視線邊緣、可以完全忽略不處理**。Chrome 後來把大 infobar 改成更收斂的 omnibox 圖示，這個演進本身就是很好的參考素材：從「一定會看到」退到「有需要才點開」，跟建議條「提醒不阻擋」的定位一致
- 事實／推測：設計原則文字是**事實**（Chromium 官方文件）；新版 omnibox bubble 的實際視覺樣式未親眼確認，需自行安裝 Chrome 觸發密碼儲存來截圖

### 6. Grammarly 語氣建議的紫色底線（區分於拼字紅、文法藍）
- 網址：https://www.grammarly.com/blog/tone-suggestions/
- 看哪裡：文中對「紫色底線＝語氣建議」的說明段落
- 怎麼解的：**用顏色本身分級嚴重程度**——紅＝一定要改的錯誤，藍＝建議修正的文法，紫＝軟性的語氣建議（可採可不採）。這給了第三種「提醒不是錯誤」的解法：不是靠拿掉顏色，而是**選一個不在「錯誤色系」裡的顏色**（紫、琥珀、靛藍都是候選，就是別用紅／橘）。三筆比較起來：Grammarly 手機版用 emoji（無色）、Chrome 用中性灰、Grammarly 網頁版用紫底線——幕聊可以在「完全去色」和「用非警示色分級」之間選一種
- 事實／推測：**事實**（官方部落格文字說明），畫面本身未親眼確認，建議設計師自行開 Grammarly 網頁編輯器打一句話觸發語氣建議來截圖，比對圖片更準

---

## 設計問題 3：輸入框內的風險詞標記（底線／高亮／波浪線）

### 7. Grammarly 編輯器色碼底線系統
- 網址：https://support.grammarly.com/hc/en-us/articles/360003474732-Grammarly-Editor-user-guide
- 看哪裡：頁面對「點底線開啟建議卡片」的操作說明段落
- 怎麼解的：**底線顏色＝問題類型，不是底線樣式（波浪／實線）＝問題類型**。這點值得注意：Grammarly 主要靠顏色分類，不是靠線型分類。幕聊如果要標「防禦／推卸／火氣」這種語氣類風險詞，可以參考「同一種線型（例如底線），用一個專屬顏色」，不用疊加波浪線這種更重的視覺語言
- 事實／推測：操作邏輯是**事實**（官方支援頁）；線型是否為波浪或實線需要實際截圖確認，本次未親眼確認

### 8. Google Docs 拼字／文法／風格三色底線
- 網址：https://support.google.com/docs/answer/57859
- 看哪裡：頁面對紅（拼字）、藍（文法）、紫（風格）三色底線的定義
- 怎麼解的：這是最主流、使用者最熟悉的底線色碼慣例——**紅＝硬錯誤、藍＝建議修正、紫＝軟性風格建議**。幕聊如果要在輸入框裡標「這句帶防禦語氣」的字詞，這組慣例暗示：用紅色會被誤讀成「打錯字」，語氣類問題更適合落在紫／藍這個區間，跟 Grammarly 的紫色語氣底線互相印證（見第 6 筆）
- 事實／推測：顏色定義是**事實**（Google 官方文件）；同時可對照 University of Melbourne 的圖文說明頁 https://www.unimelb.edu.au/accessibility/guides-for-students/grammar-checking-tools/grammar-highlighting-in-google-docs 有紅藍底線的視覺範例截圖描述，未親眼確認渲染細節

---

## 設計問題 4：從無到有的出現動態（高度 0 長出來，不能突兀）

### 9. Material Design 3 Bottom Sheet 展開／收合行為
- 網址：https://m3.material.io/components/bottom-sheets/guidelines 與實作文件 https://github.com/material-components/material-components-android/blob/master/docs/components/BottomSheet.md
- 看哪裡：guidelines 頁對 standard bottom sheet 的狀態定義；GitHub 文件裡 `behavior_fitToContents`、`behavior_halfExpandedRatio`、`BottomSheetDragHandleView` 幾段
- 怎麼解的：Android 原生元件本來就支援「從容器底部貼齊、依內容高度變化、有拖曳把手可以手動展開收合」的行為，這跟建議條「待命 0dp → 觸發 56dp → 展開 160dp」的需求形狀幾乎一致，可以直接借用它的動效邏輯（依內容 wrap，不是固定畫格淡入淡出）而不是自己重新設計一套「長出來」的動畫語言。**拖曳把手（drag handle）**這個元素也值得考慮加到 56dp 條上，暗示「這個可以再展開」
- 事實／推測：行為與 API 是**事實**（Google 官方元件文件）；把手是否適合幕聊的視覺調性是**推測**，需要設計師判斷是否要 handle 這個視覺元素（可能偏 Material 感，跟品牌「工作工具不要消費 App 感」的約束要拉一下平衡）

### 10. GitHub Copilot 灰階 ghost text（VS Code inline suggestion）
- 網址：https://code.visualstudio.com/docs/editing/ai-powered-suggestions
- 看哪裡：頁面對 inline suggestion 的說明與截圖（游標後方淡灰斜體文字）
- 怎麼解的：這不是「條」而是「文字本身的出現方式」，但值得參考的是它示範了**「建議內容用比正文更淡的視覺權重呈現，直到被接受前都像是還沒發生的事」**這個原則。對幕聊的 56dp→160dp 展開動態有旁通參考價值：觸發瞬間的內容也可以先用較低對比度／較淡的樣式出現，被使用者「看到並理解」之後才提升到正常對比度，讓「長出來」這個動作本身不搶眼
- 事實／推測：機制是**事實**（VS Code 官方文件）；把這個邏輯套用到「條狀 UI 從 0 高度長出」是**推測性類比**，不是同一種介面形態，設計師需要自行判斷是否成立

---

## 設計問題 5：收合與展開的層級（一行提示 → 完整建議，動作放哪）

### 11.（同第 3 筆）SwiftKey Copilot Tone 工具列的展開流程
- 網址：https://support.microsoft.com/en-us/topic/how-to-use-tone-in-microsoft-swiftkey-keyboard-5acbf805-e28c-41f6-8028-be405758f34a
- 看哪裡：頁面步驟 2-4，點 Copilot 圖示 → 選 Tone → 出現改寫版本 → 點 Accept 取代原文
- 怎麼解的：**觸發點在收合層（圖示），展開層才出現選項與確認動作（Accept／Copy）**。這正好對映幕聊的「觸發 56dp（一行提示＋圖示）→ 展開 160dp（完整建議＋採用鍵）」層級，可以直接借用它「收合只給入口，展開才給決策」的分層邏輯，以及「Accept 直接取代原文」這個一鍵採用的互動模式
- 事實／推測：流程是**事實**（官方支援頁逐步說明）；視覺樣式細節未親眼確認

### 12.（同第 5 筆延伸）Grammarly 瀏覽器擴充功能語氣偵測器的收合／展開
- 網址：https://support.grammarly.com/hc/en-us/articles/360034328531-Using-the-tone-detector-in-the-Grammarly-browser-extension
- 看哪裡：頁面對「點右下角 Grammarly 按鈕 → 點卡片左上角 emoji → 展開完整語氣說明」的操作說明
- 怎麼解的：跟 SwiftKey 同一種分層邏輯，但多一層——**最小狀態是一個圖示（比一行文字還輕）、中間狀態才出現一行摘要、最後才是完整卡片**。如果 56dp 真的連一行提示都嫌擠，這是備案：先只放一個狀態指示（例如一個小色點或圖示），文字延後到使用者主動點擊才出現
- 事實／推測：操作流程是**事實**（官方支援頁）；是否要采用「更輕量的圖示先行」這個備案是**推測性建議**，取決於實測 56dp 到底塞不塞得下一行中文提示字

---

## 設計問題 6：輸入法候選區的既有慣例（使用者已有什麼預期，打破的代價）

### 13.（同第 1、2 筆）iOS QuickType 與 Gboard 建議列建立的使用者預期
- 網址：（同上兩筆）
- 看哪裡：同上
- 怎麼解的：這兩個系統原生元件，多年下來已經讓「鍵盤正上方那條」在使用者心裡等於「幫我完成打字（選字／候選詞）」。幕聊的建議條做的是完全不同的事——「提醒我打的內容有問題」——**打破這個預期的代價是使用者第一反應可能誤以為它是選字候選，忽略內容或誤點**。這是這組六個問題裡風險最高的一項：**推測**建議在觸發瞬間的視覺上要主動跟候選詞列拉開差異（例如不同底色、不同字重、明確的圖示語彙），不能只靠位置一樣就套用候選詞的排版邏輯
- 事實／推測：兩個系統的既有行為是**事實**；「使用者會混淆」與「該怎麼視覺區分」是**推測**，沒有實測數據佐證，建議黑客松展示時特別留意評審第一眼反應是否誤讀

---

## 找不到可截圖公開頁的部分

- **SwiftKey Tone 工具列與 Grammarly 手機鍵盤語氣偵測器的實際像素級畫面**（顏色、字級、圓角、動效曲線）：兩者官方文件都只有文字說明或部分截圖，需要設計師自己安裝 App 觸發功能後截圖，不要用本清單裡的敘述去猜色碼。
- **Chrome 密碼儲存 bubble 目前最新版的實際視覺**：Chromium 文件講的是設計原則與歷史演進，不是目前版本的像素稿，需要自己觸發一次存密碼流程截圖。

---

## 我的判斷

- **為什麼留**：這是 FUTUREMODE 黑客松「幕聊」專案畫面 3（鍵盤建議條）的設計參考採買清單，之後餵給 Claude Design 或設計師截圖用，避免當場現找參考浪費時間。
- **下一步**：設計師依清單逐一截圖存進專案 assets，再用這些截圖跟 Claude Design 溝通視覺方向；建議優先截「找不到可截圖公開頁」那兩項提到的畫面（SwiftKey Tone、Grammarly 手機鍵盤），因為那是最貼近幕聊實際形態、但目前只有文字描述沒有截圖的兩個。
- **相關**：[[ui-brief]]、[[demo-script]]
