/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

expand(config({
  path: path.resolve(
    process.cwd(),
    process.env.NODE_ENV === "test" ? ".env.test" : ".env",
  ),
}));

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  OPENAI_API_KEY: z.string().min(1),
  /** 便宜快速的 chat 模型；見 src/shared/ai/model.ts 的選型依據 */
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  /** data/facts.json、data/contacts.json 所在目錄；預設抓 repo 根目錄的 data/ */
  DATA_DIR: z.string().optional(),
  /** prompts/ 所在目錄；預設抓 repo 根目錄的 prompts/ */
  PROMPTS_DIR: z.string().optional(),
});

export type env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line ts/no-redeclare
const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(z.treeifyError(error), null, 2));
  process.exit(1);
}

export default env!;
