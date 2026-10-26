-- Dubbele boekingen uitsluiten op databaseniveau.
-- De applicatie controleert overlap met opties en blokkades onder een
-- per-auto advisory lock; deze constraint is het vangnet voor bevestigde
-- reserveringen, ook als twee beheerders tegelijk bevestigen.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap_confirmed"
  EXCLUDE USING gist ("vehicle_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&)
  WHERE ("status" = 'bevestigd');
