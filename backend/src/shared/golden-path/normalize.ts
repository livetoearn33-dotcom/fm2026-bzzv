/**
 * Golden path 比對用的正規化：去頭尾空白、全形／半形標點統一（統一成半形）。
 *
 * 只用來「比對」——demo 現場複製貼上或手動輸入時可能夾帶不影響語意的頭尾空白，
 * 完全比對會因此漏接。標點正規化只做 1 對 1 字元替換，不改變字串長度。
 *
 * 若呼叫端要把命中結果映射回「原始輸入」的字元索引（例如 guard 的 spans 是相對
 * 原始 draft 算的），要把 `leadingTrimOffset` 加回本地座標——頭尾空白裡只有
 * 開頭的空白會讓後面的字元索引位移，結尾空白不影響。
 */

const FULLWIDTH_TO_HALFWIDTH: Record<string, string> = {
  "，": ",",
  "。": ".",
  "？": "?",
  "！": "!",
  "：": ":",
  "；": ";",
  "（": "(",
  "）": ")",
  "「": "\"",
  "」": "\"",
  "『": "'",
  "』": "'",
  "、": ",",
  "～": "~",
};

function unifyPunctuation(text: string): string {
  return [...text].map(ch => FULLWIDTH_TO_HALFWIDTH[ch] ?? ch).join("");
}

export interface NormalizedGoldenPathKey {
  /** 去頭尾空白、標點統一後的文字，只拿來當 map 的 key 比對，不對外回傳 */
  normalized: string;
  /** 開頭被裁掉的字元數；比對命中後若要換算回原始字元索引，加回這個位移 */
  leadingTrimOffset: number;
}

export function normalizeGoldenPathKey(text: string): NormalizedGoldenPathKey {
  const leadingMatch = text.match(/^\s+/);
  const leadingTrimOffset = leadingMatch ? leadingMatch[0].length : 0;
  const normalized = unifyPunctuation(text.trim());
  return { normalized, leadingTrimOffset };
}

/** 把 `Record<原始文字, T>` 轉成「正規化後文字 → T」的 Map，golden path 模組共用 */
export function buildNormalizedGoldenPathMap<T>(raw: Record<string, T>): Map<string, T> {
  const map = new Map<string, T>();
  for (const [key, value] of Object.entries(raw)) {
    map.set(normalizeGoldenPathKey(key).normalized, value);
  }
  return map;
}
