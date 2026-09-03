import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";

import { createRouter } from "@/lib/create-app";

const HealthSchema = z.object({
  status: z.literal("ok"),
  uptimeSec: z.number(),
  timestamp: z.string(),
});

const router = createRouter()
  .openapi(
    createRoute({
      tags: ["Health"],
      method: "get",
      path: "/health",
      operationId: "getHealth",
      responses: {
        [HttpStatusCodes.OK]: jsonContent(HealthSchema, "服務存活狀態"),
      },
    }),
    (c) => {
      return c.json({
        status: "ok" as const,
        uptimeSec: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      }, HttpStatusCodes.OK);
    },
  );

export default router;
