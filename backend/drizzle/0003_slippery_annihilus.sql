ALTER TABLE "contacts" DROP CONSTRAINT "contacts_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "facts" DROP CONSTRAINT "facts_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "knowledge_documents" DROP CONSTRAINT "knowledge_documents_project_id_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "contacts" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "facts" DROP COLUMN "project_id";--> statement-breakpoint
ALTER TABLE "knowledge_documents" DROP COLUMN "project_id";