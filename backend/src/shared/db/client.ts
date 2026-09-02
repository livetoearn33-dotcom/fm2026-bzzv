import { drizzle } from "drizzle-orm/node-postgres";

import env from "@/env";

export function createDb(schema: Record<string, unknown>) {
  return drizzle({
    connection: {
      connectionString: env.DATABASE_URL,
    },
    casing: "snake_case",
    schema,
  });
}

export type Db = ReturnType<typeof createDb>;
