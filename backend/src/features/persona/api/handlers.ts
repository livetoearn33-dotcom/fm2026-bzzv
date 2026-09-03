import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/shared/types";

import type { PersonaServices } from "../services";
import type { PersonaRoute } from "./routes";

import { PersonaGenerationError, PersonaNotFoundError } from "../domain/errors";

export function createPersonaHandler(services: PersonaServices): AppRouteHandler<PersonaRoute> {
  return async (c) => {
    const body = c.req.valid("json");

    try {
      const result = await services.persona(body);
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (error) {
      if (error instanceof PersonaNotFoundError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_REQUEST);
      }
      if (error instanceof PersonaGenerationError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_GATEWAY);
      }
      throw error;
    }
  };
}
