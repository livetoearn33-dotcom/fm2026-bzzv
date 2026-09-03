import type { HeatSignal, Span } from "@/shared/local-rules";

import type { GuardLlmOutput } from "../domain/llm-output.schema";
import type { GuardResponse } from "../validation/guard.schema";

/**
 * 合成規則（任務要求）：本地規則命中「或」LLM 判定任一為 true 就 flagged。
 *
 * - LLM 判 true：以 LLM 的結果為主（type/reason/suggestion 交給語意判斷）；
 *   若本地規則也命中，把它標出的驚嘆號 spans 併進去，確保火氣訊號一定被標出來。
 * - LLM 判 false 但本地規則命中：純機械訊號，用本地生成的通用建議頂上，
 *   不捏造 LLM 才有能力給的具體內容。
 * - 兩者都沒中：flagged: false，spans 空陣列，suggestion/type 為 null。
 */
export function mergeGuardSignals(llm: GuardLlmOutput, local: HeatSignal): GuardResponse {
  if (llm.flagged) {
    const spans = local.flagged ? dedupeSpans([...llm.spans, ...local.spans]) : llm.spans;
    return {
      flagged: true,
      type: llm.type,
      reason: llm.reason,
      spans,
      suggestion: llm.suggestion,
    };
  }

  if (local.flagged) {
    return {
      flagged: true,
      type: "heat",
      reason: "驚嘆號偏多，語氣可能顯得急躁",
      spans: local.spans,
      suggestion: "把多餘的驚嘆號拿掉，語氣會緩和一些。",
    };
  }

  return {
    flagged: false,
    type: null,
    reason: "",
    spans: [],
    suggestion: null,
  };
}

function dedupeSpans(spans: Span[]): Span[] {
  const seen = new Set<string>();
  const result: Span[] = [];
  for (const span of spans) {
    const key = `${span.start}-${span.end}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(span);
  }
  return result;
}
