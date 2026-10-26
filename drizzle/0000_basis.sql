CREATE TYPE "public"."block_kind" AS ENUM('onderhoud', 'blokkade');--> statement-breakpoint
CREATE TYPE "public"."promotion_kind" AS ENUM('vaste_dagprijs', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('concept', 'gepubliceerd');--> statement-breakpoint
CREATE TYPE "public"."reservation_source" AS ENUM('website', 'whatsapp', 'telefoon', 'instagram', 'handmatig');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('nieuw', 'in_behandeling', 'wacht_op_klant', 'bevestigd', 'afgewezen', 'geannuleerd', 'afgerond');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('eigenaar', 'medewerker', 'redacteur');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('concept', 'gepubliceerd', 'gearchiveerd');--> statement-breakpoint
CREATE TYPE "public"."verification_field" AS ENUM('dagprijs', 'borg', 'tariefregels', 'specificaties', 'voorwaarden', 'uitvoering', 'fotos');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"summary" text NOT NULL,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"kind" "block_kind" NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_period_valid" CHECK ("availability_blocks"."end_at" > "availability_blocks"."start_at")
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"question" text NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"status" "publish_status" DEFAULT 'concept' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid,
	"original_key" text NOT NULL,
	"original_name" text,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"placeholder" text,
	"alt" text DEFAULT '' NOT NULL,
	"focal_x" integer DEFAULT 50 NOT NULL,
	"focal_y" integer DEFAULT 50 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"note" text,
	"source_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_focal_range" CHECK ("media"."focal_x" BETWEEN 0 AND 100 AND "media"."focal_y" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" "publish_status" DEFAULT 'concept' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_vehicles" (
	"promotion_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	CONSTRAINT "promotion_vehicles_promotion_id_vehicle_id_pk" PRIMARY KEY("promotion_id","vehicle_id")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" "promotion_kind" NOT NULL,
	"value" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "publish_status" DEFAULT 'concept' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_period_valid" CHECK ("promotions"."ends_at" > "promotions"."starts_at"),
	CONSTRAINT "promotions_value_positive" CHECK ("promotions"."value" > 0)
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"from_status" "reservation_status",
	"to_status" "reservation_status",
	"data" jsonb,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reservation_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "reservation_status" DEFAULT 'nieuw' NOT NULL,
	"option_expires_at" timestamp with time zone,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"customer_message" text,
	"source" "reservation_source" DEFAULT 'website' NOT NULL,
	"dedupe_key" text,
	"created_by" uuid,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_period_valid" CHECK ("reservations"."end_at" > "reservations"."start_at")
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"password_hash" text NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_verifications" (
	"vehicle_id" uuid NOT NULL,
	"field" "verification_field" NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	CONSTRAINT "vehicle_verifications_vehicle_id_field_pk" PRIMARY KEY("vehicle_id","field")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand" text DEFAULT 'Audi' NOT NULL,
	"model" text NOT NULL,
	"edition" text,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "vehicle_status" DEFAULT 'concept' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"power_hp" integer,
	"torque_nm" integer,
	"accel_tenths" integer,
	"transmission" text,
	"plate_country" text,
	"model_year" integer,
	"min_age" integer,
	"mileage_policy" text,
	"day_rate_cents" integer,
	"weekend_rate_cents" integer,
	"week_rate_cents" integer,
	"deposit_cents" integer,
	"extra_costs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"primary_media_id" uuid,
	"source_url" text,
	"source_note" text,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_power_positive" CHECK ("vehicles"."power_hp" IS NULL OR "vehicles"."power_hp" > 0),
	CONSTRAINT "vehicles_rates_positive" CHECK (("vehicles"."day_rate_cents" IS NULL OR "vehicles"."day_rate_cents" >= 0) AND ("vehicles"."deposit_cents" IS NULL OR "vehicles"."deposit_cents" >= 0))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_vehicles" ADD CONSTRAINT "promotion_vehicles_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_vehicles" ADD CONSTRAINT "promotion_vehicles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_events" ADD CONSTRAINT "reservation_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_notes" ADD CONSTRAINT "reservation_notes_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_notes" ADD CONSTRAINT "reservation_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_verifications" ADD CONSTRAINT "vehicle_verifications_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_verifications" ADD CONSTRAINT "vehicle_verifications_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_primary_media_id_media_id_fk" FOREIGN KEY ("primary_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "blocks_vehicle_period_idx" ON "availability_blocks" USING btree ("vehicle_id","start_at");--> statement-breakpoint
CREATE INDEX "faqs_status_order_idx" ON "faqs" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX "media_vehicle_order_idx" ON "media" USING btree ("vehicle_id","sort_order");--> statement-breakpoint
CREATE INDEX "reservation_events_res_idx" ON "reservation_events" USING btree ("reservation_id","created_at");--> statement-breakpoint
CREATE INDEX "reservation_notes_res_idx" ON "reservation_notes" USING btree ("reservation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_reference_unique" ON "reservations" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "reservations_vehicle_period_idx" ON "reservations" USING btree ("vehicle_id","start_at");--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reservations_dedupe_idx" ON "reservations" USING btree ("dedupe_key","created_at");--> statement-breakpoint
CREATE INDEX "revisions_entity_idx" ON "revisions" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_slug_unique" ON "vehicles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "vehicles_status_order_idx" ON "vehicles" USING btree ("status","sort_order");