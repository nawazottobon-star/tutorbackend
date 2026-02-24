CREATE TYPE "StudyPersona" AS ENUM ('normal', 'sports', 'cooking', 'adventure');

ALTER TABLE "topics"
  ADD COLUMN "text_content_sports" TEXT,
  ADD COLUMN "text_content_cooking" TEXT,
  ADD COLUMN "text_content_adventure" TEXT;

CREATE TABLE "topic_personalization" (
    "personalization_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "persona" "StudyPersona" NOT NULL DEFAULT 'normal',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "topic_personalization_pkey" PRIMARY KEY ("personalization_id"),
    CONSTRAINT "topic_personalization_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "topic_personalization_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_topic_personalization_user_course" ON "topic_personalization" ("user_id", "course_id");
