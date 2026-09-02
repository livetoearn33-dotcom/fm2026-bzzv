import { createRouter } from "@/lib/create-app";

import type { GuardServices } from "../services";

import * as handlers from "./handlers";
import * as routes from "./routes";

export function createGuardRouter(services: GuardServices) {
  return createRouter()
    .openapi(routes.guard, handlers.createGuardHandler(services));
}
