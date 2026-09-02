import { drizzle } from "drizzle-orm/node-postgres";

import env from "@/env";
import * as taskSchema from "@/features/task/db/schema";

const schema = {
  ...taskSchema,
};

const db = drizzle({
  connection: {
    connectionString: env.DATABASE_URL,
  },
  casing: "snake_case",
  schema,
});

export default db;
