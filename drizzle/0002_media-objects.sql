CREATE TABLE "media_objects" (
	"key" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"body" "bytea" NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Foto's zijn al gecomprimeerd; Postgres hoeft ze niet nog eens te comprimeren.
ALTER TABLE "media_objects" ALTER COLUMN "body" SET STORAGE EXTERNAL;
