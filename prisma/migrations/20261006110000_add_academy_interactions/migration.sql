CREATE TABLE "academy_course_likes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academy_course_likes_pkey" PRIMARY KEY ("id")
);

-- Keep the previously public catalogue visible; only newly created courses start as drafts.
UPDATE "academy_courses"
SET "published_at" = "created_at"
WHERE "published_at" IS NULL;

CREATE TABLE "academy_course_comments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academy_course_comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academy_course_likes_user_id_course_id_key"
ON "academy_course_likes"("user_id", "course_id");

CREATE INDEX "academy_course_comments_course_id_created_at_idx"
ON "academy_course_comments"("course_id", "created_at");

ALTER TABLE "academy_course_likes"
ADD CONSTRAINT "academy_course_likes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academy_course_likes"
ADD CONSTRAINT "academy_course_likes_course_id_fkey"
FOREIGN KEY ("course_id") REFERENCES "academy_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academy_course_comments"
ADD CONSTRAINT "academy_course_comments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academy_course_comments"
ADD CONSTRAINT "academy_course_comments_course_id_fkey"
FOREIGN KEY ("course_id") REFERENCES "academy_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
