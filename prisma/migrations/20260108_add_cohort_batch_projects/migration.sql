CREATE TABLE "cohort_batch_projects" (
    "project_id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "cohort_id" uuid NOT NULL,
    "batch_no" integer NOT NULL,
    "payload" jsonb NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "cohort_batch_projects_pkey" PRIMARY KEY ("project_id"),
    CONSTRAINT "cohort_batch_projects_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts" ("cohort_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "uq_cohort_batch_projects_cohort_batch" ON "cohort_batch_projects" ("cohort_id", "batch_no");
CREATE INDEX "idx_cohort_batch_projects_cohort" ON "cohort_batch_projects" ("cohort_id");
