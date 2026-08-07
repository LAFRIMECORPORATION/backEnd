CREATE TABLE "feed_event_reads" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feed_event_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feed_event_reads_user_id_event_id_key"
  ON "feed_event_reads"("user_id", "event_id");

CREATE INDEX "feed_event_reads_user_id_idx"
  ON "feed_event_reads"("user_id");

ALTER TABLE "feed_event_reads"
  ADD CONSTRAINT "feed_event_reads_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "feed_event_reads"
  ADD CONSTRAINT "feed_event_reads_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "feed_events"("id") ON DELETE CASCADE;