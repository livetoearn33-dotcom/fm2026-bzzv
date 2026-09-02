import { buildNormalizedGoldenPathMap, normalizeGoldenPathKey } from "./normalize";

/**
 * 上台版 golden path：demo 劇本第一幕的回覆 + persona=zhuge 的改寫結果先快取
 * （見 prompts/README-組裝說明.md「角色改寫（persona，9/2 定案）」）。
 * 比對 key 是「已生成的回覆原文」；值逐字取自 docs/demo-script.md
 * 「上台版加演 · 角色改寫」段落。
 *
 * 比對用「正規化後文字完全相符」：去頭尾空白、全形／半形標點統一，不做模糊比對。
 */

export interface PersonaGoldenPathMatch {
  reply: string;
}

const PERSONA_GOLDEN_PATHS: Record<string, Record<string, PersonaGoldenPathMatch>> = {
  zhuge: {
    "收到，我確認一下進度——今晚 8 點前補完整版給您確認。目前卡在客戶端還沒回簽，已經在追。": {
      reply: "主公勿憂。臣已探得軍情：合約仍候客戶端回簽，已遣人催之。今晚八時前，完整戰報必至。",
    },
  },
};

const NORMALIZED_PERSONA_GOLDEN_PATHS = new Map(
  Object.entries(PERSONA_GOLDEN_PATHS).map(([personaId, replies]) => [
    personaId,
    buildNormalizedGoldenPathMap(replies),
  ]),
);

export function matchPersonaGoldenPath(personaId: string, reply: string): PersonaGoldenPathMatch | undefined {
  const map = NORMALIZED_PERSONA_GOLDEN_PATHS.get(personaId);
  if (!map) {
    return undefined;
  }
  const { normalized } = normalizeGoldenPathKey(reply);
  return map.get(normalized);
}
