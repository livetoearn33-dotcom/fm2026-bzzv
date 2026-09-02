import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const tasksTable = pgTable("tasks", {
  id: serial().primaryKey(),
  name: text().notNull(),
  done: boolean()
    .notNull()
    .default(false),
  createdAt: timestamp()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});
