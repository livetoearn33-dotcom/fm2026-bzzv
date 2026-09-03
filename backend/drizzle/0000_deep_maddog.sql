CREATE TYPE "public"."document_status" AS ENUM('parsing', 'extracted', 'committed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."fact_usage" AS ENUM('internal');--> statement-breakpoint
CREATE TYPE "public"."volatility" AS ENUM('high', 'low');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"tone" text NOT NULL,
	"notes" text NOT NULL,
	"recent_topics" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facts" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"content" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"volatility" "volatility" NOT NULL,
	"usage" "fact_usage",
	"source_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"file_name" text,
	"mime_type" text,
	"byte_size" integer,
	"page_count" integer,
	"status" "document_status" NOT NULL,
	"error_reason" text,
	"extracted_draft" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_source_document_id_knowledge_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE set null ON UPDATE no action;