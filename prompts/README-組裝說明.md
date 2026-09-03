# 組裝說明（給 Brian）

> 這個資料夾是 /analyze 與 /guard 提示詞的唯一真源。程式從這裡讀檔組裝，不要在程式碼裡寫死 prompt——Zeno 改檔即生效，不用等你。

## /analyze 的 system prompt 組裝

四層，照順序串接成一個 system prompt：

```
1. 引擎-analyze.md          （固定）
2. 語氣-Zeno.md             （固定）
3. 範例庫-回覆.md            （固定，全檔塞入，不抽樣——量小）
4. 〈本次任務〉               （每次請求動態組，見下）
```

### 第 4 層〈本次任務〉的組法

從 request 的 `contactId` 與 `conversation` 組出：

```
〈本次任務〉
對象：{contacts.json 該筆的 name}（{role}）
　語氣偏好：{tone}
　註記：{notes}

〈相關事實〉
- id: {fact.id}｜{fact.label}｜{fact.content}
- …（用 conversation 關鍵字對 facts.json 的 tags/label 粗篩，塞 3-5 筆；零命中就寫「（無相關事實）」）

〈對話〉
{conversation 逐則：speaker + text}

〈安全牌〉（已在畫面上顯示）
{safeCard 文字}
你的 reply 必須以這句原文開頭，接著往下寫。
```

### 契約重點

1. **safeCard 是輸入不是輸出**：由分流本地規則產生（0.2 秒先上畫面），再塞進 prompt。LLM 只回 reply。
2. **回包驗證**：檢查 `reply.startsWith(safeCard)`，不符就重打一次（最多一次）。
3. **sources 對映**：LLM 只回 fact id 陣列；response 的 `sources[{id,label}]` 由後端拿 facts.json 的 label 補齊。
4. **Golden path（已拍板）**：demo 劇本的固定訊息（見 demo-script 兩幕）直接回準備好的 JSON，不打 LLM。其他輸入走真 LLM。比對方式＝**標點正規化後完全相符**（全形半形統一＋trim，實作見 `backend/src/shared/golden-path/normalize.ts`）——不做語意模糊比對。新增 golden path 句子時要知道它不是嚴格逐字元比對。
5. 輸出要求 JSON-only 已寫在引擎層。**失敗處理分兩層**（2026-09-03 對齊實作）：
   - 模型呼叫或 schema 解析失敗 → 重打一次 → 仍失敗**回 502 錯誤**，不靜默退回假資料（刻意取捨：寧可讓前端知道壞了，也不要給使用者一個看起來正常但不是 AI 產的回覆）
   - reply 沒有以 safeCard 開頭 → 重打一次 → 仍不符則**退回 safeCard 本身當 reply**（這層退回是安全的，因為 safeCard 本來就顯示在畫面上了）

## /guard 的 system prompt 組裝

三層（比 /analyze 少一層——guard 的 few-shot 直接寫在引擎檔裡）：

```
1. 引擎-guard.md    （固定）
2. 語氣-Zeno.md     （固定）
3. 〈本次任務〉      （動態：對象檔案＋對話最後 1-3 則＋草稿原文）
```

### 契約重點

1. **觸發時機由前端／Accessibility 控**：建議 debounce（停止打字約 800ms 才送），不要每個字都打 API。
2. **flagged: false 是常態**，直接不顯示任何東西；只有 true 才長出建議條。
3. `spans` 是**草稿原文的字元索引**（0 起算、含頭不含尾）——後端要原封不動把草稿傳給前端做標記，不要 trim 或改字，索引會歪。
4. `type` 值：defensive｜blame｜heat。
5. **Golden path（已拍板）**：demo 第二幕那句「我們的品質跟別人不一樣，你可以去比較看看。」直接回準備好的 JSON（引擎檔 few-shot 例 1 就是答案），完全比對即可。

## /extract 知識萃取（9/3 定案：最小可行版）

使用者在設定頁貼一段文字或一個連結，抽成知識庫條目草稿，**使用者確認後才寫入**。範圍刻意收窄：只做「貼→抽→確認」，不做編輯與刪除 UI（CRUD API 已存在，這次不接前端）。

```
POST /v1/extract
Request:  { "input": "<使用者貼的文字>", "kind": "text" }
       或 { "input": "https://...", "kind": "url" }
Response: { "extracted": true, "items": [ ...見引擎檔輸出格式... ] }
       或 { "extracted": false, "reason": "<白話原因>" }
```

組裝（單層）：`引擎-extract.md` ＋ 〈今天日期〉＋〈使用者貼的內容〉。**不疊語氣層**——萃取是理解不是說話。

### 契約重點

1. **連結處理**：`kind: "url"` 時後端抓網頁內文再當文字送進 prompt。**抓不到就不要送 LLM**，直接回 `{ "extracted": false, "reason": "這個連結我讀不到內容，可以直接把文字貼給我" }`。現場網路不穩時這是唯一不會爆的行為。
2. **id 由後端產**：LLM 不回 id。用 label 轉英文 kebab-case，碰撞時加序號。
3. **確認才寫入**：`/extract` 只回草稿，不落檔。使用者按確認後前端再打 `PUT /v1/facts/{id}` 或 `/v1/contacts/{id}`。
4. **internal 是勾選不是自動**：`usage: "internal"` 與 `internalReason` 要在確認畫面顯示成**可勾選的開關**，預設照 LLM 判定，使用者可以改。引擎已寫明判不準時傾向標 internal——多標的代價遠小於少標。
5. `internalReason` 只是給使用者看的說明，**不寫進 facts.json**（寫入時丟棄）。
6. 最多回 3 筆；`extracted: false` 時前端顯示 `reason` 原文，不要自己改寫。

## 兩個引擎的通用組裝規則

1. **今天日期**：第 4 層〈本次任務〉開頭注入一行「今天是 YYYY-MM-DD（週X）」——「這週來得及嗎」這類時效問題沒有它會答含糊。
2. **查無對象的 fallback**：request 沒帶 contactId、或 contacts.json 查無此人時，對象段寫「對象：未知（無檔案）」，語氣照 Zeno 預設層走，不要省略整段。
3. **`usage: "internal"` 的事實**（見 data/README-知識庫.md）：可以進 prompt 當背景，但引擎紅線禁止寫進回覆；組裝時在該筆後面加一行「（內部參考，不得寫入回覆）」。

## 角色改寫（persona，9/2 定案）

使用者拿到正常回覆後，可以點角色 chip 把回覆**改寫**成角色口吻。是第二次呼叫，不動 /analyze 本體。

```
POST /persona
Request:  { "reply": "<已生成的回覆原文>", "conversation": [...], "persona": "zhuge" }
Response: { "reply": "<角色版回覆>" }
```

組裝（三層）：

```
1. 引擎極簡版（就三句，直接寫死在程式即可）：
   「把〈原回覆〉改寫成下方角色的口吻。事實、承諾、時間點不掉不加。只輸出改寫後的文字。」
2. 角色卡-{persona}.md（zhuge=諸葛亮｜ceo=霸道總裁顧北辰｜charmer=情場達人童錦城）
3. 〈原回覆〉＋〈對話〉（對話給最後 1-2 則當語境就好）
```

- **上台版 golden path**：demo 劇本那句回覆 + persona=zhuge 的改寫結果也先快取（上台要演這一下，不能賭）
- 角色卡檔案是真源，新角色＝加一個 .md，程式不用改

## 分工

- prompts/ 與 data/ 的內容：Zeno 負責，改完會說一聲
- 組裝程式、粗篩邏輯、golden path 快取：Brian 負責
- 有衝突或覺得契約不合理：直接找 Zeno 對，不要繞過這份文件自己改
