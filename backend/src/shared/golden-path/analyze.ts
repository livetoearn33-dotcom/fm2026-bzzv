import type { ConversationMessageLike } from "@/shared/local-rules/safe-card";

import { buildNormalizedGoldenPathMap, normalizeGoldenPathKey } from "./normalize";

/**
 * demo 劇本的固定訊息直接回準備好的 JSON，不打 LLM（見 prompts/README-組裝說明.md
 * 「Golden path（已拍板）」）。比對用「正規化後訊息文字完全相符」——去頭尾空白、
 * 全形／半形標點統一，不做語意上的模糊比對。
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
  "這個進度到底怎麼樣了？下午要跟客戶開會。": {
    risk: "pressure",
    riskReason: "對方在催進度，且有明確時間壓力",
    reply: "收到，我確認一下進度——今晚 8 點前補完整版給您確認。目前卡在客戶端還沒回簽，已經在追。",
    naiveReply: "收到",
    sourceIds: ["proj-a-status"],
  },
};

const NORMALIZED_ANALYZE_GOLDEN_PATHS = buildNormalizedGoldenPathMap(ANALYZE_GOLDEN_PATHS);

function pickLastThemText(conversation: ConversationMessageLike[]): string | undefined {
  for (let i = conversation.length - 1; i >= 0; i--) {
    if (conversation[i].speaker === "them") {
      return conversation[i].text;
    }
  }
  return undefined;
}

export function matchAnalyzeGoldenPath(
  conversation: ConversationMessageLike[],
): AnalyzeGoldenPathMatch | undefined {
  const lastThemText = pickLastThemText(conversation);
  if (lastThemText === undefined) {
    return undefined;
  }
  const { normalized } = normalizeGoldenPathKey(lastThemText);
  return NORMALIZED_ANALYZE_GOLDEN_PATHS.get(normalized);
}
