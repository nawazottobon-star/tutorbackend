/**
 * OpenAI Function Schemas for Tutor Copilot
 * 
 * These schemas define what functions the AI can call to fetch data.
 * The AI will automatically choose which function to call based on the user's question.
 */

export const tutorFunctionSchemas = [
    {
        name: "get_top_learners",
        description: "Get top N learners ranked by completion percentage in a cohort or entire course. Use this for questions like 'top 3 learners', 'best performers', 'highest completion', etc.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: {
                    type: "string",
                    description: "The cohort ID to query. If not provided, returns learners from the entire course.",
                },
                limit: {
                    type: "number",
                    description: "Number of learners to return (e.g., 3 for top 3, 5 for top 5)",
                },
                sort_order: {
                    type: "string",
                    enum: ["desc", "asc"],
                    description: "'desc' for highest completion first (top performers), 'asc' for lowest completion first (struggling learners)",
                },
            },
            required: ["limit"],
        },
    },
    {
        name: "get_learner_progress",
        description: "Get detailed progress information for a specific learner. Use this for questions about individual learner's completion, modules completed, or last activity.",
        parameters: {
            type: "object",
            properties: {
                identifier: {
                    type: "string",
                    description: "The name, email, or ID of the learner to query",
                },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_cohort_stats",
        description: "Get statistics for a specific cohort including average completion, total members, and cohort details. Use this for questions about cohort performance or cohort information.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: {
                    type: "string",
                    description: "The cohort ID to query",
                },
            },
            required: ["cohort_id"],
        },
    },
    {
        name: "compare_cohorts",
        description: "Compare statistics between multiple cohorts. Use this for questions like 'compare Cohort 1 vs Cohort 2' or 'which cohort is performing better'.",
        parameters: {
            type: "object",
            properties: {
                cohort_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "Array of cohort IDs to compare",
                },
            },
            required: ["cohort_ids"],
        },
    },
    {
        name: "get_active_learners",
        description: "Get list of learners who were active in the last N days. Use this for questions about recent activity or engagement.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: {
                    type: "string",
                    description: "Optional cohort ID to filter by. If not provided, returns all active learners in the course.",
                },
                days: {
                    type: "number",
                    description: "Number of days to look back (e.g., 7 for last week, 30 for last month)",
                },
            },
            required: ["days"],
        },
    },
    {
        name: "get_at_risk_learners",
        description: "Get learners who are at risk of dropping out (low completion percentage). Use this for questions about struggling learners or learners who need help.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: {
                    type: "string",
                    description: "Optional cohort ID to filter by",
                },
                threshold_percent: {
                    type: "number",
                    description: "Completion percentage threshold. Learners below this are considered at risk (e.g., 50 for learners below 50%)",
                },
            },
            required: ["threshold_percent"],
        },
    },
    {
        name: "search_learners_by_partial_name",
        description: "Search for learners by partial name or email. Use this when the user mentions a learner but you don't have their exact email.",
        parameters: {
            type: "object",
            properties: {
                search_term: {
                    type: "string",
                    description: "The name or email fragment to search for",
                },
            },
            required: ["search_term"],
        },
    },
    {
        name: "get_learner_by_any_identifier",
        description: "Get a learner's progress using any identifier like name, email, or ID. Use this as a flexible way to find a learner's data.",
        parameters: {
            type: "object",
            properties: {
                identifier: {
                    type: "string",
                    description: "The learner's name, email, or ID",
                },
            },
            required: ["identifier"],
        },
    },
    {
        name: "compare_two_learners",
        description: "Compare the progress of two learners side-by-side.",
        parameters: {
            type: "object",
            properties: {
                identifier1: { type: "string", description: "Name, email, or ID of the first learner" },
                identifier2: { type: "string", description: "Name, email, or ID of the second learner" },
            },
            required: ["identifier1", "identifier2"],
        },
    },
    {
        name: "compare_learner_to_cohort_average",
        description: "Compare a learner's progress to the average of a specific cohort.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
                cohort_id: { type: "string", description: "ID of the cohort to compare against" },
            },
            required: ["identifier", "cohort_id"],
        },
    },
    {
        name: "get_learner_module_progress",
        description: "Get detailed progress for a specific module of a learner.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
                module_no: { type: "number", description: "The module number to check" },
            },
            required: ["identifier", "module_no"],
        },
    },
    {
        name: "get_modules_in_progress",
        description: "Identify which modules a learner is currently working on (incomplete modules).",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_next_module_for_learner",
        description: "Find out what module a learner should work on next.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "rank_learners_in_cohort",
        description: "Provide a ranked list of all learners in a cohort.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: { type: "string", description: "ID of the cohort" },
            },
            required: ["cohort_id"],
        },
    },
    {
        name: "get_all_learner_emails",
        description: "Get a list of all learner emails in the current course.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "validate_learner_exists",
        description: "Check if a learner exists in the course by name, email, or ID.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "find_similar_learner_names",
        description: "Find learners with names similar to the given string.",
        parameters: {
            type: "object",
            properties: {
                name: { type: "string", description: "Part of the name to search for" },
            },
            required: ["name"],
        },
    },
    {
        name: "compare_multiple_learners",
        description: "Compare progress among multiple learners.",
        parameters: {
            type: "object",
            properties: {
                identifiers: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of learner names, emails, or IDs",
                },
            },
            required: ["identifiers"],
        },
    },
    {
        name: "get_module_attempt_history",
        description: "See the history of attempts for a specific module of a learner.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
                module_no: { type: "number", description: "Module number" },
            },
            required: ["identifier", "module_no"],
        },
    },
    {
        name: "get_failed_modules",
        description: "List modules that a learner has failed or hasn't passed yet.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_estimated_completion_date",
        description: "Predict when a learner will finish the course based on their current rate.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "find_learner_cohort",
        description: "Find which cohort(s) a learner belongs to by searching their name or email. Use this when asked 'which cohort is [learner name] in?' or similar questions.",
        parameters: {
            type: "object",
            properties: {
                learner_name_or_email: {
                    type: "string",
                    description: "The learner's name or email to search for (partial match supported)",
                },
            },
            required: ["learner_name_or_email"],
        },
    },
    {
        name: "get_all_learners_in_course",
        description: "Get a list of all learners enrolled in the current course.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_all_learners_in_cohort",
        description: "Get a list of all learners in a specific cohort.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: { type: "string", description: "ID of the cohort" },
            },
            required: ["cohort_id"],
        },
    },
    {
        name: "get_learner_details",
        description: "Get detailed profile and progress for a specific learner.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_learner_enrollment_date",
        description: "Find out when a learner joined the course.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_learner_last_activity",
        description: "Check the timestamp of the last recorded activity for a learner.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_learner_completed_modules",
        description: "Get a list of all modules a learner has successfully finished.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_learner_incomplete_modules",
        description: "Get a list of modules a learner still needs to complete.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_all_cohorts_in_course",
        description: "List all cohorts associated with this course.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_active_cohorts",
        description: "List only the cohorts that are currently active.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_cohort_member_count",
        description: "Get the number of learners in a specific cohort.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: { type: "string", description: "ID of the cohort" },
            },
            required: ["cohort_id"],
        },
    },
    {
        name: "get_cohort_average_completion",
        description: "Calculate the average completion percentage for a cohort.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: { type: "string", description: "ID of the cohort" },
            },
            required: ["cohort_id"],
        },
    },
    {
        name: "get_cohort_top_performers",
        description: "Get the highest-performing learners in a cohort.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: { type: "string", description: "ID of the cohort" },
                limit: { type: "number", description: "Number of students to list" },
            },
            required: ["cohort_id", "limit"],
        },
    },
    {
        name: "get_cohort_bottom_performers",
        description: "Get the lowest-performing learners in a cohort.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: { type: "string", description: "ID of the cohort" },
                limit: { type: "number", description: "Number of students to list" },
            },
            required: ["cohort_id", "limit"],
        },
    },
    {
        name: "get_cohort_completion_distribution",
        description: "See how many students fall into different completion percentage brackets for a cohort.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: { type: "string", description: "ID of the cohort" },
            },
            required: ["cohort_id"],
        },
    },
    {
        name: "get_cohort_activity_rate",
        description: "Calculate what percentage of a cohort has been active recently.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: { type: "string", description: "ID of the cohort" },
                days: { type: "number", description: "Number of days to check for activity" },
            },
            required: ["cohort_id", "days"],
        },
    },
    {
        name: "get_course_overview",
        description: "Get a high-level summary of the entire course performance.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_total_enrollments",
        description: "Get the total number of students enrolled in the course.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_course_average_completion",
        description: "Calculate the average completion across all course enrollments.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_course_module_list",
        description: "List all modules defined in the course structure.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_module_completion_rate",
        description: "Calculate the percentage of students who have completed a specific module across the whole course.",
        parameters: {
            type: "object",
            properties: {
                module_no: { type: "number", description: "Module number to check" },
            },
            required: ["module_no"],
        },
    },
    {
        name: "get_inactive_learners",
        description: "Identify learners who have not performed any activity in the last N days.",
        parameters: {
            type: "object",
            properties: {
                days: { type: "number", description: "Number of days of inactivity" },
            },
            required: ["days"],
        },
    },
    {
        name: "get_recently_active_learners",
        description: "List learners who have been active within the last N hours.",
        parameters: {
            type: "object",
            properties: {
                hours: { type: "number", description: "Number of hours to look back" },
            },
            required: ["hours"],
        },
    },
    {
        name: "get_learner_activity_history",
        description: "Get a chronological list of activities performed by a specific learner.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
                days: { type: "number", description: "Number of days of history to fetch" },
            },
            required: ["identifier", "days"],
        },
    },
    {
        name: "get_most_active_learners",
        description: "Rank learners by their total number of recorded activities.",
        parameters: {
            type: "object",
            properties: {
                limit: { type: "number", description: "Number of students to list" },
            },
            required: ["limit"],
        },
    },
    {
        name: "get_least_active_learners",
        description: "Identify learners with the lowest number of recorded activities.",
        parameters: {
            type: "object",
            properties: {
                limit: { type: "number", description: "Number of students to list" },
            },
            required: ["limit"],
        },
    },
    {
        name: "get_activity_by_time_of_day",
        description: "See a breakdown of when students are most active during the day.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_activity_by_day_of_week",
        description: "See which days of the week students are most active.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_engagement_score",
        description: "Get a calculated engagement score for a learner based on participation.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_dropout_risk_learners",
        description: "Identify learners at high risk of dropping out based on low activity and progress. Use this for general course health checks.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_struggling_learners",
        description: "List learners who have very low completion percentages. Note: This only identifies WHO is struggling, not WHY.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: { type: "string", description: "Optional cohort ID filter" },
            },
        },
    },
    {
        name: "get_stagnant_learners",
        description: "Identify learners who haven't made any progress in the last N days.",
        parameters: {
            type: "object",
            properties: {
                days: { type: "number", description: "Number of days without progress" },
            },
            required: ["days"],
        },
    },
    {
        name: "get_learners_needing_help",
        description: "Identify learners who have failed multiple quiz attempts.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_stuck_indicators",
        description: "Verify if a specific learner is 'stuck' and fetch recent friction signals (Idle, Browser tab hidden, cold call star). Use this for 'Is [name] stuck?' or 'Any frictions for [name]?'",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_learners_stuck_on_module",
        description: "Identify all learners who are struggling with a specific module.",
        parameters: {
            type: "object",
            properties: {
                module_no: { type: "number", description: "Module number" },
            },
            required: ["module_no"],
        },
    },
    {
        name: "get_module_statistics",
        description: "Get combined stats for a module including completion rate and attempts.",
        parameters: {
            type: "object",
            properties: {
                module_no: { type: "number", description: "Module number" },
            },
            required: ["module_no"],
        },
    },
    {
        name: "get_learners_completed_module",
        description: "List all learners who have successfully passed a module.",
        parameters: {
            type: "object",
            properties: {
                module_no: { type: "number", description: "Module number" },
            },
            required: ["module_no"],
        },
    },
    {
        name: "get_learners_failed_module",
        description: "List learners who have attempted but not yet passed a module.",
        parameters: {
            type: "object",
            properties: {
                module_no: { type: "number", description: "Module number" },
            },
            required: ["module_no"],
        },
    },
    {
        name: "get_module_average_attempts",
        description: "Calculate how many tries it takes on average to pass a module.",
        parameters: {
            type: "object",
            properties: {
                module_no: { type: "number", description: "Module number" },
            },
            required: ["module_no"],
        },
    },
    {
        name: "get_module_difficulty_ranking",
        description: "Rank modules from hardest to easiest based on student performance.",
        parameters: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "get_progress_over_time",
        description: "Fetch progress milestones for a learner over the course duration.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_enrollment_trend",
        description: "See how many students joined the course over recent months.",
        parameters: {
            type: "object",
            properties: {
                months: { type: "number", description: "Number of months to analyze" },
            },
            required: ["months"],
        },
    },
    {
        name: "get_learner_activity_signals",
        description: "Retrieve specific behavior alerts and friction signals (e.g. 'Idle detected', 'Browser tab hidden', 'Learner signaled friction'). MANDATORY for 'Why is [name] struggling?' or 'reasons for friction'.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_module_failure_reasons",
        description: "Identify why a learner might be failing a specific module.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
                module_no: { type: "number", description: "Module number" },
            },
            required: ["identifier", "module_no"],
        },
    },
    {
        name: "get_dropoff_points",
        description: "Identify the exact point where a learner stopped making progress.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
    {
        name: "get_cohort_performance_factors",
        description: "Analyze the key factors driving a cohort's performance.",
        parameters: {
            type: "object",
            properties: {
                cohort_id: { type: "string", description: "ID of the cohort" },
            },
            required: ["cohort_id"],
        },
    },
    {
        name: "get_progress_blockers",
        description: "Identify what is currently blocking a learner's progress.",
        parameters: {
            type: "object",
            properties: {
                identifier: { type: "string", description: "Name, email, or ID of the learner" },
            },
            required: ["identifier"],
        },
    },
];




