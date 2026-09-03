import { buildNormalizedGoldenPathMap, normalizeGoldenPathKey } from "./normalize";

/**
 * demo 劇本的固定訊息直接回準備好的 JSON，不打第二次生成（見
 * prompts/README-組裝說明.md「golden path 改二段式」）。
 *
 * v0.2：比對基準改成 LLM 從截圖讀出的 `conversationText`（格式固定
 * `them: 內容` / `me: 內容`，逐行、由上到下——見 prompts/引擎-analyze.md
 * 「輸出格式」），不再是原始輸入的對話陣列，因為 v0.2 輸入本身就只剩截圖，
 * 沒有文字對話可以直接比對。比對規則不變：正規化後文字完全相符，不做模糊比對。
 *
 * 值取自 docs/spec.md「API 介面」段 /analyze 的範例 response、docs/demo-script.md
 * 第一幕——兩份文件對這句訊息與 reply 的描述逐字一致，上台／備援影片都靠它保證
 * 這一幕 100% 穩定。
 */

export interface AnalyzeGoldenPathMatch {
  risk: "safe" | "pressure" | "sensitive";
  riskReason: string;
  reply: string;
  naiveReply: string;
  sourceIds: string[];
}

const ANALYZE_GOLDEN_PATHS: Record<string, AnalyzeGoldenPathMatch> = {
  "them: 這個進度到底怎麼樣了？下午要跟客戶開會。": {
    risk: "pressure",
    riskReason: "對方在催進度，且有明確時間壓力",
    reply: "收到，我確認一下進度——今晚 8 點前補完整版給您確認。目前卡在客戶端還沒回簽，已經在追。",
    naiveReply: "收到",
    sourceIds: ["proj-a-status"],
  },
};

const NORMALIZED_ANALYZE_GOLDEN_PATHS = buildNormalizedGoldenPathMap(ANALYZE_GOLDEN_PATHS);

export function matchAnalyzeGoldenPath(conversationText: string): AnalyzeGoldenPathMatch | undefined {
  const { normalized } = normalizeGoldenPathKey(conversationText);
  return NORMALIZED_ANALYZE_GOLDEN_PATHS.get(normalized);
}
