import { createRouter } from "@/lib/create-app";

import type { PersonaServices } from "../services";

import * as handlers from "./handlers";
import * as routes from "./routes";

export function createPersonaRouter(services: PersonaServices) {
  return createRouter()
    .openapi(routes.persona, handlers.createPersonaHandler(services));
}
