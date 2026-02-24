CREATE TYPE "LearnerPersonaProfileKey" AS ENUM (
  'non_it_migrant',
  'rote_memorizer',
  'english_hesitant',
  'last_minute_panic',
  'pseudo_coder'
);

CREATE TABLE "learner_persona_profiles" (
  "profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "course_id" uuid NOT NULL,
  "persona_key" "LearnerPersonaProfileKey" NOT NULL,
  "raw_answers" jsonb NOT NULL,
  "analysis_summary" text,
  "analysis_version" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "learner_persona_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE,
  CONSTRAINT "learner_persona_profiles_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("course_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "uq_persona_profile_user_course"
  ON "learner_persona_profiles" ("user_id", "course_id");
CREATE INDEX "idx_persona_profile_course" ON "learner_persona_profiles" ("course_id");
CREATE INDEX "idx_persona_profile_user" ON "learner_persona_profiles" ("user_id");
