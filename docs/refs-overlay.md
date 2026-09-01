# 喚起式浮層卡片 — 視覺參考採買清單

給誰看：負責「幕僚」浮層卡片視覺的設計師，FUTUREMODE 黑客松（9/4–9/6）。
這份清單只管**浮層卡片**（邊界、AI 文字排版、風險標記、引用標籤、逐字生成動態、可展開區塊）。
鍵盤建議條、跨 surface 一致性由另外兩組負責，不在此列。

用法：每一節對應一個設計問題，底下列出該去哪裡截圖、截哪個畫面、抄它的什麼具體做法。
標「未親眼確認」的表示我只查到文字描述／設計拆解文，沒有實際看過畫面，設計師自己開連結時要再核對一次是不是真的長那樣。

---

## 1. 喚起式浮層的邊界怎麼處理（不靠重陰影/發光）

### 1-1. Raycast — DESIGN.md 拆解（styles.refero.design）
- 網址：https://styles.refero.design/style/3b6a17f0-3bdf-418c-a95e-0b89e5a8b2f8
- 看什麼：整頁的色票、邊框規格、元件卡片規格（不是截圖，是拆解好的設計規格文件）
- 解決哪個問題：邊界處理
- 具體怎麼解：**用 1px 極淺 hairline border（rgba(255,255,255,0.06)）+「keyboard key」內陰影（inset highlight）取代 drop-shadow**。畫面 98% 無彩色，色彩只留給品牌 accent。卡片圓角 16px、按鈕/輸入框 8px、pill 用 9999px。這頁本身就是文字化的規格，可以直接照抄數值，不需要再去 App 內截圖。
- 狀態：事實（頁面內容已用 WebFetch 核對，公開可看，含實際 hex 值）

### 1-2. Linear — DESIGN.md 拆解（styles.refero.design）
- 網址：https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1
- 看什麼：同上，色票與邊框規格
- 解決哪個問題：邊界處理（次要參考，用來跟 Raycast 交叉驗證同一套「hairline + 無陰影」語言）
- 具體怎麼解：近黑背景（#08090a）、0.5px hairline 邊框、字重壓在 400–510（不用粗體撐存在感）。跟 Raycast 同一套「邊界靠對比不靠陰影」的邏輯，但更極簡。
- 狀態：事實（來自 WebSearch 摘要，未逐一核對每個數值，建議設計師自己開頁再確認）

### 1-3. Grammarly 浮動建議卡片（需自己截圖）
- 網址：沒有公開拆解頁可看；要看實機請自己在瀏覽器擴充功能或 Windows/Mac App 裡打開 Grammarly，對著一段文字操作
- 看什麼：Grammarly 的卡片浮在別的 App 內容之上（跟「幕僚」的使用情境幾乎一樣：浮在別人的畫面上，不是全螢幕接管）
- 解決哪個問題：邊界處理 + 整體調性參考（這是所有候選裡跟「幕僚」情境最像的：浮層蓋在別的產品內容上，可拖曳、用完自動收合）
- 具體怎麼解：卡片本身用陰影而非邊框分離（跟 1-1、1-2 相反），可作對照組——如果覺得 Grammarly 那種陰影感太重、太像彈出視窗，就照 Raycast 那套改用 hairline 邊框
- 狀態：**未親眼確認**，需要自己截圖，找不到公開可存取的設計拆解頁

---

## 2. AI 生成文字的呈現（當主角，不要像聊天機器人氣泡）

### 2-1. Perplexity 回答卡片 — output 拆解（AI UX Playground）
- 網址：https://aiuxplayground.com/teardowns/perplexity/output/
- 看什麼：整篇拆解 Perplexity 回答區塊的排版邏輯
- 解決哪個問題：AI 生成文字呈現
- 具體怎麼解：**把每次查詢當成一份小報告來排版，不是一則對話氣泡**——結構化的散文＋行內引用 chip＋可見的檢索步驟，用 tabbed Answer / Links / Images 分頁而不是一個滾動的聊天串。這正是「幕僚」要的方向：AI 回覆是內容主體，不是氣泡裡的一句話。
- 狀態：**未親眼確認**（文字拆解內容經 WebSearch 取得，未用 WebFetch 逐一核對排版細節）

### 2-2. Warp Terminal — AI Block 架構
- 網址：https://docs.warp.dev/terminal/blocks/
- 看什麼：官方文件裡的 Block 說明（命令＋輸出被包成一個獨立單元的視覺結構）
- 解決哪個問題：AI 生成文字呈現 + 可展開區塊（見第 6 節）
- 具體怎麼解：**把一段 AI 產出包成一個「Block」——有明確的頭（command/來源）、身體（內容）、和可操作的邊界（複製/收合/分享），而不是無邊界地流進聊天串**。「幕僚」的卡片可以借用這個「一個 block = 一個獨立、可整包操作的單元」的心智模型，而不是聊天氣泡的心智模型。
- 狀態：事實（Warp 官方文件內容，來自 WebSearch 摘要）

---

## 3. 狀態標記（風險等級）怎麼放，不搶戲但一眼看到

### 3-1. Linear — Priority 官方文件
- 網址：https://linear.app/docs/priority
- 看什麼：頁面上 No priority / Low / Medium / High / Urgent 的圖示（Linear 用一組長條高度遞增的小圖示表示優先級，不是色塊或大標籤）
- 解決哪個問題：狀態標記
- 具體怎麼解：**用極小的圖形符號（不是色塊、不是文字標籤）表示等級，靠形狀差異而不是靠顏色喊出來**，刻意只給 5 級不做更細的分級，避免使用者糾結。「幕僚」的「高壓局」風險標記可以參考這種「小圖示＋固定字詞」而非「一大塊警示色底」的做法。
- 狀態：**未親眼確認**（圖示視覺樣式來自 WebSearch 文字描述，官方頁面理論上有實際圖示可看，需自己開頁核對）

### 3-2. Carbon Design System — Status Indicator Pattern
- 網址：https://v10.carbondesignsystem.com/patterns/status-indicator-pattern/
- 看什麼：頁面上的高/中/低嚴重度狀態指示元件範例（有實際渲染出來的元件）
- 解決哪個問題：狀態標記
- 具體怎麼解：**按注目程度分級而非按警報程度分級**；不重要的狀態直接用純文字，不做成徽章——避免徽章氾濫。多重狀態合併顯示時，取「最嚴重的那個顏色」代表整體。這條給「高壓局」這類標記一個克制的判斷原則：不是每種狀態都值得做成有色徽章。
- 狀態：事實（Carbon 為 IBM 公開設計系統文件，內容穩定可信）

---

## 4. 來源引用標籤（這句話引用了哪筆資料）

### 4-1. Perplexity 引用 chip — citations 拆解（AI UX Playground）
- 網址：https://aiuxplayground.com/teardowns/perplexity/citations/
- 看什麼：拆解文裡對「inline citation chip」的說明（已用 WebFetch 核對過內容）
- 解決哪個問題：來源引用標籤
- 具體怎麼解：**chip 是圓角小標籤，貼在一句話的句尾（不是句子中間插入），標籤內文字順序是「來源名稱優先」（例如先顯示 ESPN 而不是先顯示連結），多來源時用「+N」收合，不做成看起來像按鈕的方形色塊**。這點對「引用：A 案進度 · 2026-09-05」這種標籤非常直接可用——標籤要像「附註」而不是「可點擊的 CTA」。
- 狀態：事實（已用 WebFetch 實際讀取此頁內容，非僅搜尋摘要）

---

## 5. 逐字生成的動態（先秒顯示安全開頭，完整回覆接續長出來）

### 5-1. AI UX Playground — Streaming Pattern 專頁
- 網址：https://aiuxplayground.com/pattern/streaming/
- 看什麼：整頁對「streaming」這個 UX pattern 的說明（含多個產品案例引用）
- 解決哪個問題：逐字生成的動態
- 具體怎麼解：**在 TTFT（time to first token）空窗期用閃爍游標或動畫點表示「AI 正在動」，避免使用者以為卡住；文字用 token-by-token 方式接續出現，而不是整段淡入或整句抽換**——這正好對應「幕僚」的需求：秒顯示安全開頭後，後續文字用同樣的接續生成邏輯長出來，視覺上不要用「淡入」（那樣看起來像切換內容），要用「持續生長」的游標式動態。另建議永遠給一個可見的「停止」控制。
- 狀態：**未親眼確認**（是一篇說明文，沒有嵌入可互動的即時範例；具體動畫需自己找一個有 streaming 的產品錄影或截圖 GIF）

### 5-2. Cursor — Inline Chat / 逐字串流 diff（官方 changelog）
- 網址：https://cursor.com/en/changelog/inline-chat
- 看什麼：官方 changelog 頁面裡 Cmd+K inline chat 的說明與示意（可能含動圖）
- 解決哪個問題：逐字生成的動態
- 具體怎麼解：**回覆用綠色新增/紅色刪除的方式即時串流進畫面，使用者可以在生成過程中就用 Cmd+Y 接受或 Esc 拒絕**，不用等整段生成完。這給「幕僚」一個延伸思路：逐字生成的同時，介面要一直保持「可中斷、可行動」，不是被動等它長完。
- 狀態：**未親眼確認**（changelog 頁面應含實際畫面/動圖，需自己開頁看是否還在線上；Cursor changelog 連結曾出現多個版本網址，若此連結失效可從 cursor.com/changelog 首頁找 inline chat 相關條目）

---

## 6. 可展開區塊（有限空間內收合/展開額外資訊）

### 6-1. PatternFly — Expandable Section 設計指南
- 網址：https://www.patternfly.org/components/expandable-section/design-guidelines/
- 看什麼：頁面上有實際可互動的 expandable section 元件範例（點了會展開/收合）
- 解決哪個問題：可展開區塊
- 具體怎麼解：**用箭頭方向（收合時朝右、展開時朝下）＋動態切換的文字（「顯示更多」↔「顯示更少」）表示狀態，並搭配過渡動畫**；預設收合，只有真的需要的內容才展開。這是唯一一個可以真的在瀏覽器裡點開互動、看到收合/展開動畫的參考（不是死截圖）。
- 狀態：事實（PatternFly 為 Red Hat 公開設計系統，元件為即時渲染，非圖片）

### 6-2. Warp Terminal Block 收合（同 2-2，回收使用）
- 網址：https://docs.warp.dev/terminal/blocks/
- 看什麼：同上文件中關於 Block 可 collapse/expand 的段落
- 解決哪個問題：可展開區塊
- 具體怎麼解：每個 Block（一次命令＋輸出）本身就是一個可收合的獨立單元，收合後只留命令列一行，展開才看到完整輸出。「幕僚」的「對比區塊」可以參考這種「收合時只留一行摘要，展開才看到完整對比內容」的比例控制，而不是用 Modal 或跳頁。
- 狀態：事實（同 2-2）

---

## 7. Android 系統層浮層的原生前例（補充，不對應單一設計問題）

### 7-1. Google Circle to Search / Gemini 螢幕辨識 overlay
- 網址：沒有官方設計頁可截；建議看 9to5Google 的圖文報導 https://9to5google.com/2025/01/13/circle-to-search-design/ ，或直接在支援的 Android 手機上長按 Home 鍵實測
- 看什麼：系統層浮層蓋在任意 App 畫面上的邊界處理與收合方式（左上角 X 關閉、右上角選單）
- 解決哪個問題：邊界處理（補充參考，不是卡片式浮層，是全螢幕遮罩＋局部互動，跟「幕僚」的浮層形態不同，僅供理解 Android 系統怎麼處理「蓋在別人畫面上」這件事的分寸）
- 狀態：**未親眼確認**，且形態跟本案的卡片浮層差異較大，優先度低於前六節

---

## refero.design 的 DESIGN.md 現成拆解

查過 https://styles.refero.design，確認有現成拆解好的頁面可直接用：
- Raycast（見 1-1）
- Linear（見 1-2）
- Dimension 設計系統（提到 Raycast/Linear/Arc 三者共通的「暗色畫布＋單一強調色＋hairline 邊框」語言，可作交叉比對：https://styles.refero.design/style/fbcf9cbb-7c6b-449d-862a-bce521a8ab1d ，未親眼確認細節）

沒查到 Perplexity、Warp、Superhuman、Grammarly 在 refero.design 上的拆解頁，這幾家要用第 2、4、5 節列的其他來源。

---

## 三組候選裡沒有實測驗證的部分（誠實列出）

- Arc Browser 的 Little Arc、Superhuman 命令列、Notion AI inline、Alfred/Spotlight：查過但**沒有找到公開、可直接開給設計師看畫面的頁面**（多半是文字部落格描述，或需要安裝軟體才能看到）。這幾個我判斷不適合放進「去哪截圖」清單，因為指令要求的是「可以直接打開的網址」——若設計師手邊剛好有裝這些軟體，倒是可以自己截，但沒有現成連結可給。
- 所有標「未親眼確認」的條目：內容來自文字搜尋與網頁摘要，不是我實際看到畫面後做的判斷，設計師自己開連結時務必先看一眼是否真的長那樣，再決定要不要截這張圖。
