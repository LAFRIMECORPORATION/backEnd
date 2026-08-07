-- Additive forum schema update for production compatibility
ALTER TABLE "forum_posts"
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "forum_post_likes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forum_post_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "forum_post_likes_user_id_post_id_key"
  ON "forum_post_likes" ("user_id", "post_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'forum_post_likes_post_id_fkey'
  ) THEN
    ALTER TABLE "forum_post_likes"
      ADD CONSTRAINT "forum_post_likes_post_id_fkey"
      FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'forum_post_likes_user_id_fkey'
  ) THEN
    ALTER TABLE "forum_post_likes"
      ADD CONSTRAINT "forum_post_likes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;
