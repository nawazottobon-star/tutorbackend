CREATE TABLE "module_prompt_usage" (
  "usage_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "module_no" INTEGER NOT NULL,
  "typed_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "module_prompt_usage_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE,
  CONSTRAINT "module_prompt_usage_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "uq_prompt_usage_user_course_module"
  ON "module_prompt_usage" ("user_id", "course_id", "module_no");
