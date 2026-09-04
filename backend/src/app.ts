import { createDb } from "@/db/client";
import { createAnalyzeRouter } from "@/features/analyze/api";
import { createAnalyzeServices } from "@/features/analyze/services";
import { createGuardRouter } from "@/features/guard/api";
import { createGuardServices } from "@/features/guard/services";
import healthRouter from "@/features/health/api";
import { createKnowledgeBasesRouter } from "@/features/knowledge-bases/api";
import { createKnowledgeBaseServices } from "@/features/knowledge-bases/services";
import { createKnowledgeRouter } from "@/features/knowledge/api";
import { createPersonaRouter } from "@/features/persona/api";
import { createPersonaServices } from "@/features/persona/services";
import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import { createLanguageModel } from "@/shared/ai/model";
import { DbKnowledgeBaseStore, DbKnowledgeStore } from "@/shared/knowledge";
import { loadPromptLayers } from "@/shared/prompts";

const app = createApp();

configureOpenAPI(app);

// DI 組裝
const model = createLanguageModel();
// DB-backed：listFacts/listContacts 每次都查 Postgres，/analyze、/guard 每次存取都會拿到 PUT/DELETE 之後的最新資料。
const knowledge = new DbKnowledgeStore(createDb());
const promptLayers = loadPromptLayers();

const analyzeServices = createAnalyzeServices({ model, knowledge, promptLayers });
const analyzeRouter = createAnalyzeRouter(analyzeServices);

const guardServices = createGuardServices({ model, knowledge, promptLayers });
const guardRouter = createGuardRouter(guardServices);

const personaServices = createPersonaServices({ model });
const personaRouter = createPersonaRouter(personaServices);

const knowledgeRouter = createKnowledgeRouter(knowledge);

const knowledgeBaseStore = new DbKnowledgeBaseStore(createDb());
const knowledgeBaseServices = createKnowledgeBaseServices({ model, bases: knowledgeBaseStore, knowledge, promptLayers });
const knowledgeBasesRouter = createKnowledgeBasesRouter(knowledgeBaseServices);

const v1Routes = [
  analyzeRouter,
  guardRouter,
  personaRouter,
  knowledgeRouter,
  knowledgeBasesRouter,
] as const;

app.route("/", healthRouter);
v1Routes.forEach(route => app.route("/v1", route));

export type AppType = typeof v1Routes[number];

export default app;
