import type { Span } from "@/shared/local-rules/guard-heat";

import { buildNormalizedGoldenPathMap, normalizeGoldenPathKey } from "./normalize";

/**
 * demo 第二幕那句直接回準備好的 JSON，不打 LLM（見
 * prompts/README-組裝說明.md 「/guard 契約重點」第 5 點）。
 *
 * 值取自 prompts/引擎-guard.md 的 few-shot 例 1——README 明文指定「就是答案」，
 * 逐字對應 docs/demo-script.md 第二幕的草稿與建議版本。
 *
 * 比對用「正規化後文字完全相符」：去頭尾空白、全形／半形標點統一，不做模糊比對。
 * spans 是相對「原始 draft」算的字元索引；若比對時裁掉了開頭空白，回傳前把
 * spans 位移加回去，確保索引仍對得上前端手上的原始 draft。
 */

export interface GuardGoldenPathMatch {
  type: "defensive" | "blame" | "heat";
  reason: string;
  spans: Span[];
  suggestion: string;
}

const GUARD_GOLDEN_PATHS: Record<string, GuardGoldenPathMatch> = {
  "我們的品質跟別人不一樣，你可以去比較看看。": {
    type: "defensive",
    reason: "帶防禦語氣，可能讓對方縮手",
    spans: [
      { start: 5, end: 11, label: "防禦" },
      { start: 12, end: 20, label: "防禦" },
    ],
    suggestion: "這個價格包含 A、B、C。如果預算有考量，我們也有 Y 方案可以談。",
  },
};

const NORMALIZED_GUARD_GOLDEN_PATHS = buildNormalizedGoldenPathMap(GUARD_GOLDEN_PATHS);

export function matchGuardGoldenPath(draft: string): GuardGoldenPathMatch | undefined {
  const { normalized, leadingTrimOffset } = normalizeGoldenPathKey(draft);
  const match = NORMALIZED_GUARD_GOLDEN_PATHS.get(normalized);
  if (!match) {
    return undefined;
  }
  if (leadingTrimOffset === 0) {
    return match;
  }
  return {
    ...match,
    spans: match.spans.map(span => ({
      ...span,
      start: span.start + leadingTrimOffset,
      end: span.end + leadingTrimOffset,
    })),
  };
}
