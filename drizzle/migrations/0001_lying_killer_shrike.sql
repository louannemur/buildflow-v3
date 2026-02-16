CREATE TABLE "published_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"build_output_id" uuid NOT NULL,
	"vercel_project_id" text NOT NULL,
	"vercel_deployment_id" text NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'deploying' NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "published_sites_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
ALTER TABLE "published_sites" ADD CONSTRAINT "published_sites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_sites" ADD CONSTRAINT "published_sites_build_output_id_build_outputs_id_fk" FOREIGN KEY ("build_output_id") REFERENCES "public"."build_outputs"("id") ON DELETE no action ON UPDATE no action;