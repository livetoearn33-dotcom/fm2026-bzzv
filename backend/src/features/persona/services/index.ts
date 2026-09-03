import type { PersonaServiceDeps } from "../domain/entities";

import { createPersonaService } from "./persona";

export function createPersonaServices(deps: PersonaServiceDeps) {
  return {
    persona: createPersonaService(deps),
  };
}

export type PersonaServices = ReturnType<typeof createPersonaServices>;
