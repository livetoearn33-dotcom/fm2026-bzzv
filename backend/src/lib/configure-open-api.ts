import { Scalar } from "@scalar/hono-api-reference";

import type { AppOpenAPI } from "@/shared/types";

import packageJSON from "../../package.json" with { type: "json" };

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: "fm2026-bzzv Backend API",
      description: "讀空氣 /v1/analyze、防自爆 /v1/guard、角色改寫 /v1/persona。Demo 劇本句子走 golden path 快取，其餘走 LLM。",
    },
  });

  app.get(
    "/reference",
    Scalar({
      url: "/doc",
      theme: "kepler",
      layout: "classic",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
    }),
  );
}
