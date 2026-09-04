import { generateText } from "ai";

import env from "@/env";
import { matchPersonaGoldenPath } from "@/shared/golden-path";
import { loadPersonaCard } from "@/shared/prompts";

import type { PersonaFn, PersonaServiceDeps } from "../domain/entities";
import type { PersonaResponse } from "../validation/persona.schema";

import { PersonaGenerationError, PersonaNotFoundError } from "../domain/errors";
import { buildPersonaSystemPrompt, buildPersonaTaskBlock } from "./build-prompt";

export function createPersonaService(deps: PersonaServiceDeps): PersonaFn {
  const { model } = deps;
  const mockOnLlmError = deps.mockOnLlmError ?? env.MOCK_ON_LLM_ERROR;

  return async (input) => {
    const { reply, conversation, persona } = input;

    const personaCard = loadPersonaCard(persona);
    if (!personaCard) {
      throw new PersonaNotFoundError(persona);
    }

    // Golden path：demo 劇本回覆＋persona=zhuge 的改寫結果完全相符就直接回，不打 LLM
    const goldenMatch = matchPersonaGoldenPath(persona, reply);
    if (goldenMatch) {
      const response: PersonaResponse = { reply: goldenMatch.reply };
      return response;
    }

    const systemPrompt = buildPersonaSystemPrompt(personaCard);
    const taskPrompt = buildPersonaTaskBlock({ reply, conversation });

    const callModel = () => generateText({
      model,
      system: systemPrompt,
      prompt: taskPrompt,
    });

    let rewritten: string;
    try {
      rewritten = (await callModel()).text;
    }
    catch {
      try {
        rewritten = (await callModel()).text;
      }
      catch (secondError) {
        const message = secondError instanceof Error ? secondError.message : String(secondError);
        if (mockOnLlmError) {
          // LLM 未接通：不改寫，原文照回
          console.warn(`[persona] LLM 失敗，原文照回（MOCK_ON_LLM_ERROR）：${message}`);
          return { reply };
        }
        throw new PersonaGenerationError(`LLM 呼叫失敗（已重試一次）：${message}`);
      }
    }

    const response: PersonaResponse = { reply: rewritten };
    return response;
  };
}
