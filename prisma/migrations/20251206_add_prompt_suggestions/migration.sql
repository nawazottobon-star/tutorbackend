CREATE TABLE "topic_prompt_suggestions" (
    "suggestion_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID,
    "topic_id" UUID,
    "parent_suggestion_id" UUID,
    "prompt_text" TEXT NOT NULL,
    "answer" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "topic_prompt_suggestions_pkey" PRIMARY KEY ("suggestion_id"),
    CONSTRAINT "topic_prompt_suggestions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "topic_prompt_suggestions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("topic_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "topic_prompt_suggestions_parent_suggestion_id_fkey" FOREIGN KEY ("parent_suggestion_id") REFERENCES "topic_prompt_suggestions"("suggestion_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_prompt_course" ON "topic_prompt_suggestions" ("course_id");
CREATE INDEX "idx_prompt_topic" ON "topic_prompt_suggestions" ("topic_id");
CREATE INDEX "idx_prompt_parent" ON "topic_prompt_suggestions" ("parent_suggestion_id");
