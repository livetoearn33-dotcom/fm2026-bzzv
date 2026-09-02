import db from "@/db";
import indexRouter from "@/features/index/api";
import { createTaskRouter } from "@/features/task/api";
import { createTaskRepository } from "@/features/task/repositories";
import { createTaskServices } from "@/features/task/services";
import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";

const app = createApp();

configureOpenAPI(app);

// DI 組裝
const taskRepository = createTaskRepository(db);
const taskServices = createTaskServices({ taskRepository });
const taskRouter = createTaskRouter(taskServices);

const v1Routes = [
  indexRouter,
  taskRouter,
] as const;

v1Routes.forEach(route => app.route("/v1", route));

export type AppType = typeof v1Routes[number];

export default app;
