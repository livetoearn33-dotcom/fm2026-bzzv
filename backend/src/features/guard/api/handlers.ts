import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/shared/types";

import type { GuardServices } from "../services";
import type { GuardRoute } from "./routes";

import { GuardGenerationError } from "../domain/errors";

export function createGuardHandler(services: GuardServices): AppRouteHandler<GuardRoute> {
  return async (c) => {
    const body = c.req.valid("json");

    try {
      const result = await services.guard(body);
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (error) {
      if (error instanceof GuardGenerationError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_GATEWAY);
      }
      throw error;
    }
  };
}
