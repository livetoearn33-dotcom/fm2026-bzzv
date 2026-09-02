import type { Contact } from "@/shared/knowledge";
import type { PromptLayers } from "@/shared/prompts";

import type { GuardConversationMessage } from "../validation/guard.schema";

const RECENT_MESSAGE_COUNT = 3;

/**
 * /guard 的 system prompt 組裝，照 prompts/README-組裝說明.md：
 * 引擎-guard.md → 語氣-Zeno.md → 〈本次任務〉（比 /analyze 少一層，few-shot 直接寫在引擎檔）。
 */
export function buildGuardSystemPrompt(layers: PromptLayers, taskBlock: string): string {
  return [layers.guardEngine, layers.tone, taskBlock].join("\n\n---\n\n");
}

function formatConversation(conversation: GuardConversationMessage[]): string {
  const recent = conversation.slice(-RECENT_MESSAGE_COUNT);
  if (recent.length === 0) {
    return "（無對話紀錄）";
  }
  return recent
    .map(message => `${message.speaker === "them" ? "對方" : "我"}：${message.text}`)
    .join("\n");
}

export interface BuildGuardTaskBlockInput {
  contact: Contact | undefined;
  conversation: GuardConversationMessage[];
  draft: string;
}

export function buildGuardTaskBlock(input: BuildGuardTaskBlockInput): string {
  const { contact, conversation, draft } = input;

  const contactBlock = contact
    ? `對象：${contact.name}（${contact.role}）\n  語氣偏好：${contact.tone}\n  註記：${contact.notes}`
    : "對象：（無對象資料）";

  return [
    "〈本次任務〉",
    contactBlock,
    "",
    "〈對話最後 1-3 則〉",
    formatConversation(conversation),
    "",
    "〈草稿〉",
    draft,
  ].join("\n");
}
