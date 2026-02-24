-- Create learner_activity_events table
CREATE TABLE IF NOT EXISTS "learner_activity_events" (
    "event_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "module_no" INTEGER,
    "topic_id" UUID,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "derived_status" TEXT,
    "status_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "learner_activity_events_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE,
    CONSTRAINT "learner_activity_events_course_id_fkey"
      FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE,
    CONSTRAINT "learner_activity_events_topic_id_fkey"
      FOREIGN KEY ("topic_id") REFERENCES "topics"("topic_id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "idx_learner_activity_course_user_created"
  ON "learner_activity_events" ("course_id", "user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_learner_activity_user_created"
  ON "learner_activity_events" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_learner_activity_topic"
  ON "learner_activity_events" ("topic_id");
