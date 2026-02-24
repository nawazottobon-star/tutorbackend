CREATE TABLE "simulation_exercises" (
    "exercise_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "simulation_exercises"
  ADD CONSTRAINT "simulation_exercises_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "topics"("topic_id") ON DELETE CASCADE ON UPDATE CASCADE;
