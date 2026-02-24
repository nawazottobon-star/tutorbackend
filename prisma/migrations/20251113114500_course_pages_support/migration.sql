-- Add richer catalog metadata
ALTER TABLE "courses"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS "level" TEXT NOT NULL DEFAULT 'Beginner',
  ADD COLUMN IF NOT EXISTS "instructor" TEXT NOT NULL DEFAULT 'Staff Instructor',
  ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
  ADD COLUMN IF NOT EXISTS "students" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT,
  ADD COLUMN IF NOT EXISTS "hero_video_url" TEXT,
  ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill slug for existing rows then enforce uniqueness
UPDATE "courses"
SET "slug" = regexp_replace(lower(coalesce("course_name", gen_random_uuid()::text)), '[^a-z0-9]+', '-', 'g')
WHERE "slug" IS NULL;

ALTER TABLE "courses"
  ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "courses_slug_key" ON "courses" ("slug");

-- Table to capture tutor applications from the new Become a Tutor page
CREATE TABLE IF NOT EXISTS "tutor_applications" (
  "application_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "full_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "expertise_area" TEXT NOT NULL,
  "proposed_course_title" TEXT NOT NULL,
  "course_level" TEXT,
  "delivery_format" TEXT,
  "availability" TEXT,
  "experience_years" INTEGER,
  "course_outline" TEXT,
  "motivation" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Page content CMS table for About/Courses/Become-a-tutor static copy
CREATE TABLE IF NOT EXISTS "page_content" (
  "page_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "hero_image" TEXT,
  "sections" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "page_content_slug_key" ON "page_content" ("slug");
