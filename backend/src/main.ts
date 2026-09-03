import { serve } from "@hono/node-server";

import app from "@/app";
import { runMigrations } from "@/db/migrate";
import env from "@/env";

const port = env.PORT;

await runMigrations();
// eslint-disable-next-line no-console
console.log("✅ DB migrations applied");

// eslint-disable-next-line no-console
console.log(`Server is running on port http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
