/**
 * 防自爆的「驚嘆號密度」本地規則（見 docs/spec.md「三個機制」第 3 節、
 * prompts/引擎-guard.md 的 heat 類訊號）。
 *
 * 只判「密度」這個機械訊號，不判語意（防禦／推卸交給 LLM）。
 * 命中就跟 LLM 的判定做 OR 合成，見 features/guard/services 的合成規則。
 */

export interface Span {
  start: number;
  end: number;
  label: string;
}

export interface HeatSignal {
  flagged: boolean;
  spans: Span[];
}

const EXCLAMATION_PATTERN = /[!！]/g;

/** 兩個含以上的驚嘆號視為密度過高；短句只出現一個也算密度高 */
const COUNT_THRESHOLD = 2;
const SHORT_DRAFT_LENGTH = 15;

export function detectHeatSignal(draft: string): HeatSignal {
  const matches = [...draft.matchAll(EXCLAMATION_PATTERN)];

  const flagged = matches.length >= COUNT_THRESHOLD
    || (matches.length >= 1 && draft.length <= SHORT_DRAFT_LENGTH);

  if (!flagged) {
    return { flagged: false, spans: [] };
  }

  const spans: Span[] = matches.map(match => ({
    start: match.index!,
    end: match.index! + match[0].length,
    label: "火氣",
  }));

  return { flagged: true, spans };
}
