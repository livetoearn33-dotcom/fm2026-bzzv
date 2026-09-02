import type { PersonaConversationMessage } from "../validation/persona.schema";

const RECENT_MESSAGE_COUNT = 2;

/**
 * /persona 的引擎極簡版——三句話，直接寫死在程式即可（見
 * prompts/README-組裝說明.md「角色改寫」段第 1 層，逐字照抄）。
 */
const PERSONA_ENGINE_PROMPT
  = "把〈原回覆〉改寫成下方角色的口吻。事實、承諾、時間點不掉不加。只輸出改寫後的文字。";

/**
 * /persona 的 system prompt 組裝，照 README 的順序：
 * 引擎極簡版 → 角色卡-{persona}.md。
 */
export function buildPersonaSystemPrompt(personaCard: string): string {
  return [PERSONA_ENGINE_PROMPT, personaCard].join("\n\n---\n\n");
}

function formatConversation(conversation: PersonaConversationMessage[]): string {
  const recent = conversation.slice(-RECENT_MESSAGE_COUNT);
  if (recent.length === 0) {
    return "（無對話紀錄）";
  }
  return recent
    .map(message => `${message.speaker === "them" ? "對方" : "我"}：${message.text}`)
    .join("\n");
}

export interface BuildPersonaTaskBlockInput {
  reply: string;
  conversation: PersonaConversationMessage[];
}

/**
 * 組〈原回覆〉＋〈對話〉（對話只給最後 1-2 則當語境，見 README）。
 */
export function buildPersonaTaskBlock(input: BuildPersonaTaskBlockInput): string {
  const { reply, conversation } = input;

  return [
    "〈原回覆〉",
    reply,
    "",
    "〈對話〉",
    formatConversation(conversation),
  ].join("\n");
}
