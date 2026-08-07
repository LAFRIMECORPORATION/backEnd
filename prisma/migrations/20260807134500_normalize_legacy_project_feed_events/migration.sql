UPDATE "feed_events"
SET "event_type" = 'project_approved'
WHERE "event_type" = 'project_published'
  AND "metadata" ? 'title';