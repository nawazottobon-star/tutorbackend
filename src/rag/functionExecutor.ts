import {
    getTopLearnersByCohort,
    getLearnerProgress,
    getCohortStats,
    compareCohorts,
    getActiveLearners,
    getAtRiskLearners,
    findLearnerCohort,
    searchLearnersByPartialName,
    getLearnerByAnyIdentifier,
    compareTwoLearners,
    compareLearnerToCohortAverage,
    getLearnerModuleProgress,
    getModulesInProgress,
    getNextModuleForLearner,
    rankLearnersInCohort,
    getAllLearnerEmails,
    validateLearnerExists,
    findSimilarLearnerNames,
    compareMultipleLearners,
    getModuleAttemptHistory,
    getFailedModules,
    getEstimatedCompletionDate,
    getAllLearnersInCourse,
    getAllLearnersInCohort,
    getLearnerDetails,
    getLearnerEnrollmentDate,
    getLearnerLastActivity,
    getLearnerCompletedModules,
    getLearnerIncompleteModules,
    getAllCohortsInCourse,
    getActiveCohorts,
    getCohortMemberCount,
    getCohortAverageCompletion,
    getCohortTopPerformers,
    getCohortBottomPerformers,
    getCohortCompletionDistribution,
    getCohortActivityRate,
    getCourseOverview,
    getTotalEnrollments,
    getCourseAverageCompletion,
    getCourseModuleList,
    getModuleCompletionRate,
    getInactiveLearners,
    getRecentlyActiveLearners,
    getLearnerActivityHistory,
    getMostActiveLearners,
    getLeastActiveLearners,
    getActivityByTimeOfDay,
    getActivityByDayOfWeek,
    getEngagementScore,
    getDropoutRiskLearners,
    getStrugglingLearners,
    getStagnantLearners,
    getLearnersNeedingHelp,
    getStuckIndicators,
    getLearnersStuckOnModule,
    getModuleStatistics,
    getLearnersCompletedModule,
    getLearnersFailedModule,
    getModuleAverageAttempts,
    getModuleDifficultyRanking,
    getProgressOverTime,
    getEnrollmentTrend,
    getLearnerActivitySignals,
    getModuleFailureReasons,
    getDropoffPoints,
    getCohortPerformanceFactors,
    getProgressBlockers,
} from "../services/tutorQueries";

/**
 * Resolve a name, email, or ID to a verified email address or return an error result
 */
async function resolveIdentifier(courseId: string, identifier: string): Promise<{ email: string } | { error: any; message: string }> {
    const result = await getLearnerByAnyIdentifier({ courseId, identifier });
    if (result && 'error' in result) {
        return { error: true, message: String((result as any).message || (result as any).error) };
    }
    return { email: (result as any).email };
}

/**
 * Execute a tutor copilot function based on the function name and arguments
 * 
 * @param functionName - Name of the function to execute
 * @param args - Arguments for the function
 * @param courseId - Course ID for data isolation (REQUIRED)
 * @returns Function execution result
 */
export async function executeTutorFunction(
    functionName: string,
    args: Record<string, any>,
    courseId: string
): Promise<any> {
    // CRITICAL: All functions receive courseId for data isolation
    // This ensures the AI can only access data for the current course

    switch (functionName) {
        case "get_top_learners":
            return await getTopLearnersByCohort({
                courseId,
                cohortId: args.cohort_id,
                limit: args.limit || 10,
                sortOrder: args.sort_order || 'desc',
            });

        case "get_learner_progress":
            return await getLearnerByAnyIdentifier({
                courseId,
                identifier: args.identifier || args.learner_email,
            });

        case "get_cohort_stats":
            return await getCohortStats({
                courseId,
                cohortId: args.cohort_id,
            });

        case "compare_cohorts":
            return await compareCohorts({
                courseId,
                cohortIds: args.cohort_ids,
            });

        case "get_active_learners":
            return await getActiveLearners({
                courseId,
                cohortId: args.cohort_id,
                days: args.days || 7,
            });

        case "get_at_risk_learners":
            return await getAtRiskLearners({
                courseId,
                cohortId: args.cohort_id,
                thresholdPercent: args.threshold_percent || 50,
            });

        case "find_learner_cohort":
            return await findLearnerCohort({
                courseId,
                learnerNameOrEmail: args.learner_name_or_email,
            });

        case "search_learners_by_partial_name":
            return await searchLearnersByPartialName({
                courseId,
                searchTerm: args.search_term,
            });

        case "get_learner_by_any_identifier":
            return await getLearnerByAnyIdentifier({
                courseId,
                identifier: args.identifier,
            });

        case "compare_two_learners": {
            const res1 = await resolveIdentifier(courseId, args.identifier1 || args.email1);
            if ('error' in res1) return res1;
            const res2 = await resolveIdentifier(courseId, args.identifier2 || args.email2);
            if ('error' in res2) return res2;
            return await compareTwoLearners({
                courseId,
                email1: res1.email,
                email2: res2.email,
            });
        }

        case "compare_learner_to_cohort_average": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await compareLearnerToCohortAverage({
                courseId,
                learnerEmail: res.email,
                cohortId: args.cohort_id,
            });
        }

        case "get_learner_module_progress": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getLearnerModuleProgress({
                courseId,
                learnerEmail: res.email,
                moduleNo: args.module_no,
            });
        }

        case "get_modules_in_progress": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getModulesInProgress({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_next_module_for_learner": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getNextModuleForLearner({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "rank_learners_in_cohort":
            return await rankLearnersInCohort({
                courseId,
                cohortId: args.cohort_id,
            });

        case "get_all_learner_emails":
            return await getAllLearnerEmails({
                courseId,
            });

        case "validate_learner_exists":
            return await validateLearnerExists({
                courseId,
                identifier: args.identifier,
            });

        case "find_similar_learner_names":
            return await findSimilarLearnerNames({
                courseId,
                name: args.name,
            });

        case "compare_multiple_learners": {
            const identifiers = args.identifiers || args.emails || [];
            const emails = [];
            for (const id of identifiers) {
                const res = await resolveIdentifier(courseId, id);
                if ('error' in res) return res;
                emails.push(res.email);
            }
            return await compareMultipleLearners({
                courseId,
                emails,
            });
        }

        case "get_module_attempt_history": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getModuleAttemptHistory({
                courseId,
                learnerEmail: res.email,
                moduleNo: args.module_no,
            });
        }

        case "get_failed_modules": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getFailedModules({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_estimated_completion_date": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getEstimatedCompletionDate({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_all_learners_in_course":
            return await getAllLearnersInCourse({
                courseId,
            });

        case "get_all_learners_in_cohort":
            return await getAllLearnersInCohort({
                courseId,
                cohortId: args.cohort_id,
            });

        case "get_learner_details": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getLearnerDetails({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_learner_enrollment_date": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getLearnerEnrollmentDate({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_learner_last_activity": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getLearnerLastActivity({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_learner_completed_modules": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getLearnerCompletedModules({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_learner_incomplete_modules": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getLearnerIncompleteModules({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_all_cohorts_in_course":
            return await getAllCohortsInCourse({
                courseId,
            });

        case "get_active_cohorts":
            return await getActiveCohorts({
                courseId,
            });

        case "get_cohort_member_count":
            return await getCohortMemberCount({
                courseId,
                cohortId: args.cohort_id,
            });

        case "get_cohort_average_completion":
            return await getCohortAverageCompletion({
                courseId,
                cohortId: args.cohort_id,
            });

        case "get_cohort_top_performers":
            return await getCohortTopPerformers({
                courseId,
                cohortId: args.cohort_id,
                limit: args.limit,
            });

        case "get_cohort_bottom_performers":
            return await getCohortBottomPerformers({
                courseId,
                cohortId: args.cohort_id,
                limit: args.limit,
            });

        case "get_cohort_completion_distribution":
            return await getCohortCompletionDistribution({
                courseId,
                cohortId: args.cohort_id,
            });

        case "get_cohort_activity_rate":
            return await getCohortActivityRate({
                courseId,
                cohortId: args.cohort_id,
                days: args.days,
            });

        case "get_course_overview":
            return await getCourseOverview({
                courseId,
            });

        case "get_total_enrollments":
            return await getTotalEnrollments({
                courseId,
            });

        case "get_course_average_completion":
            return await getCourseAverageCompletion({
                courseId,
            });

        case "get_course_module_list":
            return await getCourseModuleList({
                courseId,
            });

        case "get_module_completion_rate":
            return await getModuleCompletionRate({
                courseId,
                moduleNo: args.module_no,
            });

        case "get_inactive_learners":
            return await getInactiveLearners({
                courseId,
                days: args.days,
            });

        case "get_recently_active_learners":
            return await getRecentlyActiveLearners({
                courseId,
                hours: args.hours,
            });

        case "get_learner_activity_history": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getLearnerActivityHistory({
                courseId,
                learnerEmail: res.email,
                days: args.days,
            });
        }

        case "get_most_active_learners":
            return await getMostActiveLearners({
                courseId,
                limit: args.limit,
            });

        case "get_least_active_learners":
            return await getLeastActiveLearners({
                courseId,
                limit: args.limit,
            });

        case "get_activity_by_time_of_day":
            return await getActivityByTimeOfDay({
                courseId,
            });

        case "get_activity_by_day_of_week":
            return await getActivityByDayOfWeek({
                courseId,
            });

        case "get_engagement_score": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getEngagementScore({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_dropout_risk_learners":
            return await getDropoutRiskLearners({
                courseId,
            });

        case "get_struggling_learners":
            return await getStrugglingLearners({
                courseId,
                cohortId: args.cohort_id,
            });

        case "get_stagnant_learners":
            return await getStagnantLearners({
                courseId,
                days: args.days,
            });

        case "get_learners_needing_help":
            return await getLearnersNeedingHelp({
                courseId,
            });

        case "get_stuck_indicators": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getStuckIndicators({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_learners_stuck_on_module":
            return await getLearnersStuckOnModule({
                courseId,
                moduleNo: args.module_no,
            });

        case "get_module_statistics":
            return await getModuleStatistics({
                courseId,
                moduleNo: args.module_no,
            });

        case "get_learners_completed_module":
            return await getLearnersCompletedModule({
                courseId,
                moduleNo: args.module_no,
            });

        case "get_learners_failed_module":
            return await getLearnersFailedModule({
                courseId,
                moduleNo: args.module_no,
            });

        case "get_module_average_attempts":
            return await getModuleAverageAttempts({
                courseId,
                moduleNo: args.module_no,
            });

        case "get_module_difficulty_ranking":
            return await getModuleDifficultyRanking({
                courseId,
            });

        case "get_progress_over_time": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getProgressOverTime({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_enrollment_trend":
            return await getEnrollmentTrend({
                courseId,
                months: args.months,
            });

        case "get_learner_activity_signals": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getLearnerActivitySignals({
                courseId,
                learnerEmail: res.email,
                days: args.days || 30,
            });
        }

        case "get_module_failure_reasons": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getModuleFailureReasons({
                courseId,
                learnerEmail: res.email,
                moduleNo: args.module_no,
            });
        }

        case "get_dropoff_points": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getDropoffPoints({
                courseId,
                learnerEmail: res.email,
            });
        }

        case "get_cohort_performance_factors":
            return await getCohortPerformanceFactors({
                courseId,
                cohortId: args.cohort_id,
            });

        case "get_progress_blockers": {
            const res = await resolveIdentifier(courseId, args.identifier || args.learner_email);
            if ('error' in res) return res;
            return await getProgressBlockers({
                courseId,
                learnerEmail: res.email,
            });
        }




        default:
            throw new Error(`Unknown function: ${functionName}`);
    }
}
