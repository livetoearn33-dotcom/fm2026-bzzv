import { createRouter } from "@/lib/create-app";

import type { AnalyzeServices } from "../services";

import * as handlers from "./handlers";
import * as routes from "./routes";

export function createAnalyzeRouter(services: AnalyzeServices) {
  return createRouter()
    .openapi(routes.analyze, handlers.createAnalyzeHandler(services));
}
