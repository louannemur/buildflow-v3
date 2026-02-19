ALTER TABLE "build_outputs" ADD COLUMN "preview_token" text;--> statement-breakpoint
ALTER TABLE "usage" ADD COLUMN "project_tokens_used" integer DEFAULT 0 NOT NULL;