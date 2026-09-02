import db from "@/db";
import { createAnalyzeRouter } from "@/features/analyze/api";
import { createAnalyzeServices } from "@/features/analyze/services";
import { createGuardRouter } from "@/features/guard/api";
import { createGuardServices } from "@/features/guard/services";
import healthRouter from "@/features/health/api";
import { createPersonaRouter } from "@/features/persona/api";
import { createPersonaServices } from "@/features/persona/services";
import { createTaskRouter } from "@/features/task/api";
import { createTaskRepository } from "@/features/task/repositories";
import { createTaskServices } from "@/features/task/services";
import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import { createLanguageModel } from "@/shared/ai/model";
import { loadKnowledgeStore } from "@/shared/knowledge";
import { loadPromptLayers } from "@/shared/prompts";

const app = createApp();

configureOpenAPI(app);

// DI 組裝
const taskRepository = createTaskRepository(db);
const taskServices = createTaskServices({ taskRepository });
const taskRouter = createTaskRouter(taskServices);

const model = createLanguageModel();
const knowledge = loadKnowledgeStore();
const promptLayers = loadPromptLayers();

const analyzeServices = createAnalyzeServices({ model, knowledge, promptLayers });
const analyzeRouter = createAnalyzeRouter(analyzeServices);

const guardServices = createGuardServices({ model, knowledge, promptLayers });
const guardRouter = createGuardRouter(guardServices);

const personaServices = createPersonaServices({ model });
const personaRouter = createPersonaRouter(personaServices);

const v1Routes = [
  taskRouter,
  analyzeRouter,
  guardRouter,
  personaRouter,
] as const;

app.route("/", healthRouter);
v1Routes.forEach(route => app.route("/v1", route));

export type AppType = typeof v1Routes[number];

export default app;
