ALTER TABLE "published_sites" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "published_sites" ADD CONSTRAINT "published_sites_slug_unique" UNIQUE("slug");