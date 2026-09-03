import * as HttpStatusCodes from "stoker/http-status-codes";

import type { AppRouteHandler } from "@/shared/types";

import type { AnalyzeServices } from "../services";
import type { AnalyzeRoute } from "./routes";

import { AnalyzeGenerationError, InvalidScreenshotError } from "../domain/errors";

export function createAnalyzeHandler(services: AnalyzeServices): AppRouteHandler<AnalyzeRoute> {
  return async (c) => {
    const body = c.req.valid("json");

    try {
      const result = await services.analyze(body);
      return c.json(result, HttpStatusCodes.OK);
    }
    catch (error) {
      if (error instanceof AnalyzeGenerationError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_GATEWAY);
      }
      if (error instanceof InvalidScreenshotError) {
        return c.json({ message: error.message }, HttpStatusCodes.BAD_REQUEST);
      }
      throw error;
    }
  };
}
