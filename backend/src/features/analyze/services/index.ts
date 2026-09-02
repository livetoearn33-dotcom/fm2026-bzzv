import type { AnalyzeServiceDeps } from "../domain/entities";

import { createAnalyzeService } from "./analyze";

export function createAnalyzeServices(deps: AnalyzeServiceDeps) {
  return {
    analyze: createAnalyzeService(deps),
  };
}

export type AnalyzeServices = ReturnType<typeof createAnalyzeServices>;
