# 跨 surface 識別參考：兩個形狀差很多的介面，怎麼看起來是同一個產品

這份給做「幕聊」視覺的人（以及把 prompt 貼進 Claude Design 的人）。
只處理一個問題：**浮層卡片（寬、空間充裕）與鍵盤建議條（56dp 高、只放得下一行）之間的視覺關聯怎麼刻意設計。**
浮層本身長什麼樣、建議條本身長什麼樣，另有兩份參考在處理，這份不重複。

標記慣例：【事實】＝有第一手來源；【二手】＝來自報導或第三方拆解，未經官方確認；【推測】＝我的推論，沒有來源。
凡是我沒有親眼看到畫面的，會寫「未親眼確認」。

---

## 第一部分 · 八個真實案例

### 1. Apple Live Activities / 靈動島（最直接對應我們的題目）

**為什麼是最好的參考**：Apple 強迫同一份內容同時活在四種尺寸裡，尺寸落差比我們大得多，而且他們把規則寫成了公開文件。

【事實】官方規格（iPhone 17 Pro / 393×852pt 這一組）：

| 呈現 | 尺寸（pt） |
|---|---|
| Compact leading | 52.33 × 36.67 |
| Compact trailing | 52.33 × 36.67 |
| Minimal | 36.67–45 × 36.67 |
| Expanded | 371 × 84–160 |
| Lock Screen | 371 × 84–160 |

也就是說 Apple 的「窄版」只有寬版的 1/7 寬、1/4 高。**我們的落差（浮層約 350×200dp vs 建議條 360×56dp）比 Apple 溫和很多**，Apple 解得掉，我們沒有藉口解不掉。順帶一提，Apple 的 expanded 高度上限是 160pt——跟我們建議條展開後的 160dp 幾乎一樣，可以直接拿他們的版面當底。

**他們靠什麼建立識別**（以下皆為官網原文重點，【事實】）：

- 「Create a Live Activity that **matches your app's visual aesthetic and personality** in both dark and light appearances. This makes it easier for people to recognize your Live Activity and creates a visual connection to your app.」
- 「**Use color to express the character and identity of your app.** Live Activities in the Dynamic Island use a black opaque background. Consider using bold colors for text and objects to convey the personality and brand of your app.」→ 在最小的空間裡，**顏色是主要的識別載體**，不是 logo。
- 「**If you include a logo mark, display it without a container.** This better integrates the logo mark with your Live Activity layout. **Don't use the entire app icon.**」→ 小空間放的是「去容器的純字標／符號」，不是 app icon。這條可以直接抄。
- 「**Maintain the relative placement of elements** to create a coherent layout between presentations. The expanded presentation is an enlarged version of the compact or minimal presentation. Ensure information and layouts expand predictably.」→ 大版是小版的放大，不是另一個版。
- 「Ensure **unified information and design** of the compact presentations… design them to read as a single piece of information, and **use consistent color and typography** to help create a connection between both elements.」
- 「Ensure text is easy to read. **Use large, heavier-weight text — a medium weight or higher.** Use small text sparingly.」→ 反直覺但重要：**空間變小時字重要往上加，不是往下縮。**
- 「Ensure that your Live Activity is **recognizable in the minimal presentation**. If possible, **display updated information rather than just a logo**… For example, the Timer app's minimal presentation displays the remaining time instead of a static icon.」→ 極小空間放「活的資訊」比放 logo 更能被認出來。這條和我們的建議條直接相關。
- Lock Screen 標準邊距是 14pt。

網址：<https://developer.apple.com/design/human-interface-guidelines/live-activities>
打開後看：先看 **Best practices** 段（顏色與 logo mark 兩條），再看 **Presentation → Compact / Minimal / Expanded** 三段，最後看頁尾 **Specifications** 的 iOS dimensions 表。

---

### 2. Spotify（唯一一份把「全螢幕／widget／橫條／通知」寫成同一份規範的官方文件）

**共用的是什麼**：一個**最小尺寸下限**、一個**背景色演算法**、一個**不可變形的符號**。

【事實】官方 Design & Branding Guidelines 明說這份規範適用於「fullscreen views, widgets, bars, skipped song notifications」——把我們的題目（大卡片 vs 橫條）當成同一件事處理。具體規則：

- **Logo（含字標）不得小於 70px；Icon（純符號）不得小於 21px。** → 這是業界少見的公開數字，直接回答了「56dp 裡放得下多大的識別」：**21px 起跳的純符號，是可行的**。
- **背景色從專輯封面萃取（Android Palette），萃取不到才 fallback 到 #191414。** → 識別不靠固定色塊，靠「一套產生顏色的規則」。這一招我們可以改成：顏色由「氣氛等級」決定，兩個 surface 用同一套映射。
- **一定要用 logo 或 icon 標注內容來源**，符號本身不得旋轉、拉伸、填色、與其他形狀組合。

網址：<https://developer.spotify.com/documentation/design>
打開後看：「Using our logo」的最小尺寸段，以及「Playback」段裡列出適用 surface 的那句話。

【二手】2021 年 Android mini player 改版：改成浮在內容上、圓角、專輯封面縮小但圓角跟著容器走、進度條從上緣移到下緣（來源：Android Police）。未親眼確認現行版本。

---

### 3. Raycast（形態最接近我們：喚起 → 做完 → 消失）

**共用的是什麼**：**一條永遠在底部的動作列（ActionPanel）**＋**一階一階的表面色階（不是陰影）**＋**極度節制的單一強調色**。

【事實】Raycast 的擴充 API 文件自己說 「Think of it as a design system」，並把 UI 收斂成四種容器（List / Grid / Detail / Form），每一種都掛同一個 `ActionPanel`。也就是說：不論內容長什麼樣，**底部那條「動作 ＋ 快捷鍵」的橫列永遠在同一個位置**。這條橫列本身就是識別。

【事實】HUD 是它的「窄版 surface」：動作完成後主視窗關閉、螢幕底部出現一條小訊息。同一個產品，一個是大面板一個是小橫條——靠的是同一套字級、同一個圓角、同一個深色表面色階。

【二手】第三方拆解（Refero / awesome-design-md）指出：官網只有深色一種模式、沒有淺色版；用「表面色階」做層級而不是投影；珊瑚紅 #ff6363 只保留給 logo、hero、AI badge，**不當成一般強調色到處用**；按鈕／輸入框／badge 用 8px 圓角，卡片用 16–20px。
⚠️ 這些數值是網站（行銷頁）的，不是 App 本體的，別直接照抄。

網址：
- <https://developers.raycast.com/api-reference/user-interface>（看它怎麼把 UI 收斂成四種容器）
- <https://developers.raycast.com/api-reference/feedback/hud>（看窄版 HUD 的定位）
- <https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md>（第三方拆解的具體數值）

---

### 4. Linear（App / Command Palette / 通知）

**共用的是什麼**：**一個 4px 網格**、**一段極窄的字重帶**、**強調色佔畫面像素的比例**。

【二手，來自多份第三方拆解與 Linear 官方工程文章】

- 所有 padding、margin、icon 尺寸、字級都是 4 的倍數；圓角只有 6px 和 12px 兩個值，沒有第三個。
- 字重全部落在 400–510 之間，沒有粗體。字距 -0.022em。
- 邊框 0.5px 髮絲線，用幾何而不是陰影做層級。
- 【事實，Linear 官方文章】他們把主題產生器從 HSL 改成 **LCH** 色彩空間，因為 LCH 感知上均勻——同一個亮度值的紅色和黃色看起來一樣亮，所以不論使用者選什麼底色，產生出來的主題都不會壞掉。
- 最值得抄的一句拆解【二手】：**「ranges are rules, single values are samples」**——真正讓 Linear 一眼可辨的不是那個色碼，是「強調色只佔極小比例的像素、其餘全是灰」這個**比例**。抄了色碼卻用一般 SaaS 的密度去鋪，就只有調色盤像、個性完全不像。

網址：
- <https://linear.app/now/how-we-redesigned-the-linear-ui>（官方，看 LCH 那段）
- <https://github.com/voltagent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md>（第三方數值拆解）

---

### 5. Arc Browser（側欄 / Little Arc 小視窗 / 注入網頁）

**共用的是什麼**：**一組 CSS 變數形式的主題色，跟著你進入每一個 surface，包含別人的網頁。**

【二手】Arc 的每個 Space 有自己的主題色（可選漸層、加顆粒），而這組色**以 CSS variable 注入每一個分頁**（`var(--arc-palette-background)` 之類），Boosts 功能就是靠這個運作的。等於說：識別不是畫在介面上的裝飾，是一個**可以被任何容器讀取的變數**。

Little Arc 則是它的「窄版 surface」：從別的 App 點連結時開的單分頁小視窗，沒有 chrome。第三方設計評論的結論值得記：**「match interface weight to task」——不是每個任務都需要完整的介面重量。**

⚠️ 狀態註記【事實】：Arc 已於 2025 年進入維護模式，公司被 Atlassian 收購，團隊轉做 Dia。當參考可以，別當作「還在演進的標竿」。

網址：
- <https://resources.arc.net/hc/en-us/articles/19228064149143-Spaces-Distinct-Browsing-Areas>（看 Space 主題色）
- <https://resources.arc.net/hc/en-us/articles/19235387524503-Little-Arc-Quick-Lookups-Instant-Triaging>（看窄版）
- ⚠️ 這兩頁是說明文件、截圖不多，**視覺質感需要自己裝來截圖**。

---

### 6. 1Password（桌面 App / 瀏覽器擴充的 inline menu / 系統自動填入）

**共用的是什麼**：**一個「圖示＋標題＋副標」的列（row）原語**，在任何寬度下都長一樣，只是換容器。

【二手，來自 1Password 官方部落格與 release notes】2024 年的產品更新特別提到一件事：以前 inline menu 點 1Password 圖示只給「Save in 1Password」，**現在密碼產生器、擴充設定、回報問題都能從 autofill menu 直接進入，且跨所有瀏覽器擴充統一**。這是有意識地把「窄 surface 的動作集合」對齊到主 App。

這個案例同時是正例也是反例，反例的部分見第三部分。

網址：<https://1password.com/blog/product-update-features-and-security-q3-2024>
打開後看：Autofill 那一段的截圖。**inline menu 的實際視覺需要自己裝擴充截圖**，官方沒有把它獨立成設計文件。

---

### 7. Grammarly（編輯器 / 瀏覽器擴充的角落圓鈕 / 鍵盤 App）

**共用的是什麼**：**一個 combination mark 的分工制度**——符號單獨用於小空間（app icon、瀏覽器按鈕），字標只在空間允許時出現。加上一個**功能性的顏色語意**（底線顏色＝問題類型），這個色系在三個 surface 都成立。

【二手】2024 年改版把綠色圓形 G 換成更暗的「pin 形」對話泡＋更方正的字標，官方說法是要讓它「不論在瀏覽器擴充還是手機上都站得住」。

⚠️ 重要時效註記【事實】：Grammarly 公司已於 2025 年更名為 **Superhuman**（併入 Coda 與 Superhuman Mail），品牌色從招牌綠改成紫／棗紅系。**Grammarly 綠這個識別已經在母品牌層級退場了**，找參考時注意你看到的是哪一版。

也值得看一個設計師的批評【二手】：他認為舊版的 G 圖示原本在產品 UI 裡扮演「隨時提醒你這是 Grammarly」的角色，新版把這個 UX 功能拿掉了，變得比較通用。這正是我們要避免的錯誤。

網址：
- <https://www.underconsideration.com/brandnew/archives/new_logo_for_grammarly.php>（2024 改版拆解，有並排圖）
- <https://www.grammarly.com/blog/company/announcing-company-rebrand-to-superhuman/>（官方，2025 更名公告）
- <https://carlwaldron.com/grammarlys-new-logo-is-meh/>（那篇批評）

---

### 8. Notion AI（側欄 / 全頁 / 頁面右下角浮鈕）

**共用的是什麼**：**一個刻意「不通用」的符號。**

【二手】Notion 曾經跟 Figma、WordPress、Google Photos、Coda、Miro 一樣用 ✨ 星火圖示代表 AI。後來他們把 AI 的形象換成一個有臉的角色（內部叫 "Nosy"），這個符號會依任務變形，出現在側欄、全頁、頁面右下角的圓形浮鈕。

**這件事對我們的意義最大**：✨ 這個符號識別的是「AI」，不是「Notion」。**任何人用它，都在替整個 AI 品類做品牌，不是替自己做。** 我們的建議條只有一個圖示的位置，如果放 ✨，那個位置的識別價值等於零——使用者看到的是「某個 AI 功能」，不是「幕聊」。

網址：
- <https://css-tricks.com/the-proliferation-and-problem-of-the-sparkles-icon/>（星火圖示氾濫的整理，有大量並排範例）
- <https://www.fastcompany.com/91192119/notions-new-animated-ai-assistant-looks-more-new-yorker-than-clippy>（Notion 換角色的報導）

---

## 第二部分 · 可以直接寫進設計規範的做法清單

先定一個框架，後面的規則都掛在這上面。

> **不變量（invariants）**：在兩個 surface 都必須一模一樣，改了就是兩個產品。
> **可變量（variables）**：在窄 surface 可以（也應該）被犧牲。
> **壓縮**＝只動可變量。**換一套設計**＝動到不變量。

### A. 必須在兩個 surface 都保留的（不變量）

**規則 1 — 一條 3dp 的狀態帶，貼在前緣，兩邊都有。**
浮層卡片左緣一條 3dp 的垂直色帶，建議條左緣**同一條**（同寬 3dp、同位置、同顏色映射）。顏色由氣氛等級決定：一般＝中性灰（#…，待定）／高壓＝琥珀／敏感＝紅。
為什麼選它當主要識別載體：(a) 它是同一個形狀原語在同一個位置，不是「像」而是「同一個東西」；(b) 它承載功能資訊，不是裝飾，通過「工作工具」的調性檢查；(c) 它只吃 3dp 寬、零高度，在 56dp 裡活得下來。
依據：Apple「Use color to express the character and identity of your app」＋「Maintain the relative placement of elements」。
（這是我提的具體方案，屬【推測】；替代方案見規則 12。）

**規則 2 — 顏色語意的映射表，兩邊共用同一張，且窄 surface 一次只出現一種顏色。**
定一張表：氣氛等級 → 色票。浮層可以同時出現風險標記色 ＋ 來源標籤色 ＋ 動作色；建議條**同一時間只准出現一種彩色**，其餘全部走灰階。
依據：Linear 的比例原則（強調色只佔極小比例像素）；Spotify 用「產生顏色的規則」而不是固定色塊。

**規則 3 — 前緣內距與圖示尺寸，兩邊用同一組數字。**
建議一組：前緣內距 16dp、識別符號 20dp、符號到文字 12dp。這三個數字在浮層卡片和建議條裡完全相同，是「同一隻手做的」最便宜的證據。
依據：Apple「Maintain the relative placement of elements」；Spotify 的 icon 下限 21px 說明 20dp 級距是可行的。

**規則 4 — 圓角只准有兩個值，且兩邊共用。**
例如外容器 12dp、內部元件 6dp，沒有第三個值。建議條因為要貼齊鍵盤上緣，只圓上面兩角，但**半徑必須是同一個 12dp**。
另外抄 Apple 的同心圓規則：內部元件靠近容器圓角時，內圓角＝外圓角 − 邊距，不要讓方角戳出弧線。
依據：Linear（只有 6 和 12 兩個值）；Apple「Use consistent margins and concentric placement」。

**規則 5 — 動效參數兩邊完全相同，這是 56dp 裡最便宜的識別。**
同一組時長（150–250ms）、同一條緩動（ease-out）、同一個進入方向邏輯（都從「它所依附的邊」長出來：浮層從上、建議條從鍵盤上緣向上推）。文字生成一律用「接續長出」而不是整句抽換。
動效不佔任何像素，是窄 surface 唯一沒有預算限制的識別維度。
依據：Apple「preserve as much of the existing layout as possible by animating existing elements to their new positions」。

**規則 6 — 動作動詞的寫法與按鈕形態兩邊一致。**
都用文字按鈕（不是填色 pill）、都靠右對齊、都用動詞不用「確認」。浮層的「採用」和建議條的「採用」必須是同一個視覺物件。
依據：ui-brief 已定的「單鍵審核動詞」；Raycast 的 ActionPanel 永遠在同一個位置。

### B. 應該在窄空間被犧牲掉的（可變量）

**規則 7 — 陰影／高度感：建議條完全不准有。**
浮層是浮在別的 App 上，需要邊界（用 1px 邊框或色階，不用重陰影）。建議條是鍵盤的一部分，**任何陰影都會讓它變成「浮在鍵盤上的第三方東西」，直接破壞它的正當性**。用背景色階與鍵盤區分即可。
依據：Raycast 用表面色階不用投影；ui-brief 已寫「推開而不是蓋住」。

**規則 8 — 層級數量：4 級砍到 2 級。**
浮層有四級（對方訊息 / 風險標記 / AI 回覆 / 來源標籤）。建議條**只准兩級**：一行提示（主）＋ 一個動作（次）。來源標籤、對比區塊、原訊息在收合狀態一律不出現；要出現就是展開到 160dp 之後的事。
依據：Apple「Focus on important information… Your Live Activity doesn't need to display everything」。

**規則 9 — 留白可以壓，但只准壓垂直，不准壓前緣內距。**
垂直方向從舒服的 16dp 壓到 8dp 沒問題；**前緣 16dp 內距一動都不能動**，因為那是規則 3 的識別錨點。壓錯方向就散掉了。

**規則 10 — 字標（wordmark）在窄 surface 一律不出現，只留符號。**
而且符號**不要放在容器裡**（不要圓底、不要方底、不要卡片），直接放單色 glyph。
依據：Apple 原文「If you include a logo mark, display it without a container… Don't use the entire app icon」；Grammarly 的 combination mark 分工。

**規則 11 — 字級可以降一級，但字重要升一級。**
這條反直覺，但兩個來源都指向它：小空間的文字要更容易被瞄到，所以 15sp/Regular 到了建議條變成 14sp/Medium，不是 13sp/Regular。
依據：Apple「Use large, heavier-weight text — a medium weight or higher. Use small text sparingly」。

### C. 底線與檢查方法

**規則 12 — 識別載體要挑「功能性的」，不要挑「裝飾性的」。**
候選排序（從最好到最差）：
1. 承載狀態資訊的色帶／色點（規則 1）— 最好，它有存在的理由
2. 一個自製的、非通用的 20dp 單色 glyph（規則 10）
3. 字級／字重／間距的比例關係
4. 動效簽名
5. ❌ 純裝飾的品牌色塊、漸層、logo lockup — 在工作工具裡等於雜訊
6. ❌❌ **✨ 星火圖示** — 它識別的是「AI」不是「幕聊」，等於把識別預算捐給整個品類（見案例 8）

**規則 13 — 建議條要「像自己的兄弟」，同時「不像宿主」。**
這是雙向的：它要跟浮層像，也要跟 Gboard／SwiftKey 自己的候選字條**明顯不像**，否則使用者會以為那是輸入法內建功能，我們的產品直接隱形。
分辨手段就用規則 1 的狀態帶——原生候選字條沒有前緣色帶。
（此為【推測】，但 1Password 的反例證明了「過度相似」是真實風險，見第三部分。）

**規則 14 — 三個驗收測試，交件前跑一次。**
1. **灰階縮圖測試**：兩張圖都轉灰階、縮到 25%，並排。還能不能看出是同一隻手做的？如果只有顏色一樣、結構不一樣，會在這關現形。
2. **遮蔽測試**：把兩張圖的文字全部塗黑，只留形狀與色塊。剩下的骨架是不是同一套？
3. **陌生人測試**：把建議條單獨拿給沒看過浮層的人看 3 秒，再給他看浮層，問「這兩個是同一個 App 嗎」。答不出來就是沒過。

**規則 15 — 「壓縮」與「換一套」的分界線，用一句話判：元素的相對位置有沒有改變。**
Apple 的原則是 expanded 是 compact 的放大版，資訊要「predictably」展開。翻成我們的話：
- 浮層左邊是狀態帶 → 建議條左邊也要是狀態帶
- 浮層動作在右下 → 建議條動作在右
- 浮層主文字在中央偏左 → 建議條那一行也在中央偏左
**只要有一個元素在窄版換了邊，那就已經是「另一套設計」，不是壓縮。**

---

## ⭐ 核心問題：56dp 的橫條裡，可以用什麼承載品牌識別？

先把預算算清楚。56dp 扣掉最小可觸控目標 48dp，上下只剩約 4dp 餘裕（【二手】Android 建議最小觸控目標 48dp ≈ 9mm）。所以垂直方向幾乎沒有空間可談，**識別必須從水平方向和非空間維度來拿**。

實際可用的五樣，按性價比排序：

| # | 載體 | 成本 | 為什麼可行 |
|---|---|---|---|
| 1 | **前緣 3dp 狀態色帶** | 3dp 寬、0 高 | 同形狀、同位置、同色彩語意；有功能理由，不是裝飾 |
| 2 | **20dp 單色自製 glyph**（去容器） | 20dp 寬 | Spotify 官方下限是 21px，20dp 在實體尺寸上等價，是驗證過可行的下限 |
| 3 | **同一組間距數字**（前緣 16 / 圖文 12） | 0 | 免費。人認得出節奏，即使說不出為什麼 |
| 4 | **同一組動效參數**（150–250ms ease-out、同進入方向） | 0 | 完全不佔像素，是 56dp 裡最被低估的識別維度 |
| 5 | **同一種「一次只一個彩色」的克制**（Linear 比例原則） | 0 | 克制本身就是識別。所有競品都在這裡失手 |

**明確不要放的**：字標、app icon、任何有容器的 logo、漸層、✨、第二個彩色元素、任何陰影。

**如果只能留一樣**：留 **1（前緣狀態色帶）**。它是唯一同時滿足「同一個形狀原語」「同一個位置」「有功能理由」「幾乎不佔空間」四個條件的東西。Apple 在比我們更小的空間裡得到的結論也是同一個——顏色是識別，logo 不是。

---

## 第三部分 · 三個反例

### 反例 1 — Windows 11：Settings vs Control Panel（同一個 OS，兩個時代）

【二手】長年被批評的「split brain」：表層是現代化的 Settings，點兩層就掉進視覺語言完全不同的舊 Control Panel 對話框。
**錯在哪**：不是顏色不對，是**兩套介面各自完整、各自自洽，但骨架來自不同年代**。使用者要先記住「這個設定屬於哪個時代」才找得到。有評論說得很準：使用者是用最粗糙的那一角來評價整個系統——乾淨的 Settings 頁一旦通到過時的 applet，整個「一致」的幻覺就破了。
**對我們的教訓**：**建議條不能是「順手做的第二個東西」。** 只要它的骨架來自另一次設計會議，使用者一定看得出來。做法上就是先把兩個 surface 的不變量（規則 1–6）定死，再各自展開。
網址：<https://www.windowslatest.com/2026/04/07/microsoft-explains-why-it-still-cant-fully-kill-control-panel-in-windows-11/>
打開後看：文中並排的 Settings 與 Control Panel 截圖。

### 反例 2 — Skype 2017 改版：手機端像 Snapchat，桌面端不像

【二手】Microsoft 2017 年的 Skype 改版在行動端加了 Capture 區與 Highlights（近似 Snapchat 限時動態），桌面端維持原樣。結果是同一個品牌的兩個 surface 讀起來像兩個不同世代、不同客群的產品。多篇事後檢討把它當成「Skype 身分危機」的代表事件。
**錯在哪**：**每個 surface 各自去追它所在平台的當紅形式**，而不是各自去表達同一個產品的個性。手機上流行什麼就做什麼，桌面上不流行就不做——識別就這樣被平台慣例吃掉了。
**對我們的教訓**：建議條會很想「長得像輸入法該有的樣子」（因為它住在鍵盤上）。**要抵抗這個引力**——它首先是幕聊，其次才是鍵盤上的東西（呼應規則 13）。
網址：<https://www.eleken.co/blog-posts/bad-ux-examples>
打開後看：Skype 那一節。⚠️ 這是二手整理，2017 年的原始截圖要另外找，或到 The Verge 搜當年報導。

### 反例 3 — 1Password：擴充的 inline menu vs macOS 原生自動填入（「太像」也是一種失敗）

【二手，來自 1Password 社群與 PiunikaWeb 報導】1Password 推出 macOS 原生自動填入（beta）後，它跟瀏覽器擴充的 inline menu 視覺上太接近，**使用者分不出眼前這個選單是哪一個機制**，把新的原生選單誤認成舊的擴充選單。同時在 iOS 上，因為系統自動填入與擴充 inline menu 會衝突且「目前沒有技術解」，官方直接把擴充的 inline menu 藏起來，引發反彈。
**錯在哪**：識別做對了（兩個看起來都是 1Password），但**沒有留下區分行為的線索**。同一個品牌的兩個 surface 如果行為不同，就必須有一個穩定的視覺差異來標記「這是哪一個」。
**對我們的教訓**：浮層卡片和建議條的**行為不同**——一個是「AI 幫你寫」，一個是「AI 攔你寫的」。它們該共用骨架，但要有一個一致的、可預期的差異標記（例如狀態帶的色相區間不同，或符號的方向不同）。**共用不是複製。**
網址：<https://www.1password.community/1password-at-home-31/me-271-feedback-inline-menu-hidden-in-safari-on-ios-when-system-autofill-is-enabled-24290>
⚠️ 這是社群討論串，實際視覺對比**需要自己裝來截圖**。

### 附帶反例 — ✨ 星火圖示（不是單一產品，是整個品類的集體失敗）

見案例 8。當 Figma、Notion、WordPress、Google Photos、Coda、Miro 都用同一個符號代表 AI 時，這個符號的識別價值歸零。**在 56dp 只有一個圖示位置的情況下，用 ✨ 等於放棄那個位置。**
網址：<https://css-tricks.com/the-proliferation-and-problem-of-the-sparkles-icon/>

---

## 交給 Claude Design 的時候可以直接貼的一段

```
這個產品有兩個 surface（浮層卡片、56dp 鍵盤建議條），版面不同但必須是同一個產品。
請把以下當成「不變量」，兩個 surface 一模一樣，不准為了配合空間而調整：

1. 前緣 3dp 垂直狀態色帶（顏色＝氣氛等級：一般灰／高壓琥珀／敏感紅），
   位置、寬度、色彩映射兩邊完全相同
2. 前緣內距 16dp、識別符號 20dp、符號到文字間距 12dp
3. 圓角只有兩個值：外容器 12dp、內部元件 6dp。建議條只圓上兩角，半徑仍是 12dp
4. 動效：150–250ms、ease-out、從所依附的邊長出來
5. 動作一律文字按鈕、靠右、用動詞
6. 任何時候只有一個彩色元素，其餘走灰階

以下在建議條裡必須被犧牲：
- 陰影（完全不准有，它是鍵盤的一部分不是浮起來的東西）
- 層級從 4 級降到 2 級（只留一行提示＋一個動作）
- 字標、來源標籤、對比區塊
- 垂直留白可壓，前緣 16dp 內距不准壓

字級降一級但字重升一級（15sp Regular → 14sp Medium）。
不要用 ✨ 星火圖示。不要把符號放進圓底或方底容器裡。
```

---

## 資料來源與可信度

**第一手（官方文件，可直接引用）**
- Apple HIG · Live Activities — <https://developer.apple.com/design/human-interface-guidelines/live-activities>（規格表與 best practices 全部逐字確認過）
- Spotify Design & Branding Guidelines — <https://developer.spotify.com/documentation/design>
- Raycast API · User Interface / HUD — <https://developers.raycast.com/api-reference/user-interface> ／ <https://developers.raycast.com/api-reference/feedback/hud>
- Linear · How we redesigned the Linear UI — <https://linear.app/now/how-we-redesigned-the-linear-ui>
- Grammarly（現 Superhuman）更名公告 — <https://www.grammarly.com/blog/company/announcing-company-rebrand-to-superhuman/>
- Arc 說明文件 — <https://resources.arc.net/hc/en-us/articles/19228064149143-Spaces-Distinct-Browsing-Areas>
- 1Password 產品更新 — <https://1password.com/blog/product-update-features-and-security-q3-2024>

**第三方拆解（數值可參考，非官方）**
- awesome-design-md（Raycast / Linear）— <https://github.com/VoltAgent/awesome-design-md>
- Brand New · Grammarly 新 logo — <https://www.underconsideration.com/brandnew/archives/new_logo_for_grammarly.php>
- CSS-Tricks · 星火圖示氾濫 — <https://css-tricks.com/the-proliferation-and-problem-of-the-sparkles-icon/>

**未查證／需要自己截圖**
- 1Password inline menu 的實際視覺（官方沒有設計文件）
- Arc Little Arc 與 Space 主題的實際質感（說明頁截圖不足，且產品已進維護模式）
- Skype 2017 改版的原始截圖
- Notion「Nosy」在三個 surface 的實際呈現（只找到報導，未親眼確認）
- 56dp 這個數字本身：沒有找到任何官方文件把它定為建議條標準高度。可確認的相關數字只有 Android 最小觸控目標 48dp。若要精確，請查 AOSP LatinIME 的 `config_suggestions_strip_height`
