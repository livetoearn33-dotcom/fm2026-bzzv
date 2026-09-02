import type { Span } from "@/shared/local-rules/guard-heat";

/**
 * demo 第二幕那句直接回準備好的 JSON，不打 LLM（見
 * prompts/README-組裝說明.md 「/guard 契約重點」第 5 點）。
 *
 * 值取自 prompts/引擎-guard.md 的 few-shot 例 1——README 明文指定「就是答案」。
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

export function matchGuardGoldenPath(draft: string): GuardGoldenPathMatch | undefined {
  return GUARD_GOLDEN_PATHS[draft];
}
