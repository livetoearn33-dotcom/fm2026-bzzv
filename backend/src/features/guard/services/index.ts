import type { GuardServiceDeps } from "../domain/entities";

import { createGuardService } from "./guard";

export function createGuardServices(deps: GuardServiceDeps) {
  return {
    guard: createGuardService(deps),
  };
}

export type GuardServices = ReturnType<typeof createGuardServices>;
