CREATE TYPE "public"."knowledge_base_status" AS ENUM('extracting', 'draft', 'committed', 'failed');--> statement-breakpoint
CREATE TABLE "knowledge_bases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"status" "knowledge_base_status" NOT NULL,
	"error_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "knowledge_base_id" uuid;--> statement-breakpoint
ALTER TABLE "facts" ADD COLUMN "knowledge_base_id" uuid;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "knowledge_base_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;