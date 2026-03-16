import express from "express";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth.js";
import { prisma } from "../services/prisma.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";
import { sendEmail } from "../services/emailService.js";

export const workshopsRouter = express.Router();

// Helper to get tutor from auth
const getTutor = async (userId: string) => {
    return await prisma.tutor.findUnique({
        where: { userId },
    });
};

// CREATE Workspace
workshopsRouter.post(
    "/",
    requireAuth,
    asyncHandler(async (req, res) => {
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth?.userId || "");

        if (!tutor) {
            res.status(403).json({ message: "Only tutors can create workshops" });
            return;
        }

        const { title, topic, description, googleMeetLink, maxSeats, scheduledAt, courseId } = req.body;

        // Validate course ownership
        const course = await prisma.courseTutor.findUnique({
            where: {
                courseId_tutorId: {
                    tutorId: tutor.tutorId,
                    courseId: courseId
                }
            }
        });

        if (!course) {
            res.status(403).json({ message: "You must use one of your courses to anchor the workshop" });
            return;
        }

        // 1. Create or Find CourseOffering (program_type = 'workshop')
        const offering = await prisma.courseOffering.upsert({
            where: {
                courseId_programType_title: {
                    courseId,
                    programType: 'workshop',
                    title
                }
            },
            update: {
                description,
                isActive: true,
                priceCents: 0,
                applicationRequired: true,
                assessmentRequired: true,
            },
            create: {
                courseId,
                programType: 'workshop',
                title,
                description,
                isActive: true,
                priceCents: 0,
                applicationRequired: true,
                assessmentRequired: true,
            }
        });

        // 2. Create or Find Workshop linking to offering
        let workshop = await prisma.workshop.findUnique({
            where: { offeringId: offering.offeringId }
        });

        if (!workshop) {
            workshop = await prisma.workshop.create({
                data: {
                    offeringId: offering.offeringId,
                    tutorId: tutor.tutorId,
                    googleMeetLink,
                    maxSeats: maxSeats ? parseInt(maxSeats) : null,
                }
            });

            // 3. Create initial WorkshopSession
            await prisma.workshopSession.create({
                data: {
                    offeringId: offering.offeringId,
                    scheduledAt: new Date(scheduledAt),
                    sessionNo: 1
                }
            });
        }

        res.status(201).json({ workshopId: workshop.workshopId, offeringId: offering.offeringId });
    })
);

// SCHEDULE NEW RUN — creates a new WorkshopSession row (session_no + 1)
workshopsRouter.post(
    "/:id/sessions",
    requireAuth,
    asyncHandler(async (req, res) => {
        try {
            const { id } = req.params;
            const auth = (req as AuthenticatedRequest).auth;
            const tutor = await getTutor(auth?.userId || "");

            if (!tutor) {
                res.status(403).json({ message: "Only tutors can schedule new runs" });
                return;
            }

            const { scheduledAt, googleMeetLink, maxSeats, questions } = req.body;
            if (!scheduledAt) {
                res.status(400).json({ message: "scheduledAt is required" });
                return;
            }

            // Verify ownership
            const workshop = await prisma.workshop.findFirst({
                where: { workshopId: id, tutorId: tutor.tutorId },
                include: {
                    offering: {
                        include: {
                            workshopSessions: { orderBy: { sessionNo: 'desc' }, take: 1 }
                        }
                    }
                }
            });

            if (!workshop) {
                res.status(404).json({ message: "Workshop not found or access denied" });
                return;
            }

            const lastSession = workshop.offering.workshopSessions[0];
            const lastSessionNo = lastSession?.sessionNo ?? 0;

            // CRITICAL VALIDATION: Cannot schedule a new run if the current run is still in the future
            if (lastSession && new Date(lastSession.scheduledAt) > new Date()) {
                res.status(400).json({
                    message: "Cannot schedule a new run while the current session is still upcoming or active. Please wait until the current session completes."
                });
                return;
            }

            // Execute all updates in a transaction to ensure data integrity
            const result = await prisma.$transaction(async (tx) => {
                // 1. Create the new session
                const newSession = await tx.workshopSession.create({
                    data: {
                        offeringId: workshop.offeringId,
                        scheduledAt: new Date(scheduledAt),
                        sessionNo: lastSessionNo + 1,
                    }
                });

                // 2. Update the main Workshop with new link and seats
                if (googleMeetLink !== undefined || maxSeats !== undefined) {
                    await tx.workshop.update({
                        where: { workshopId: id },
                        data: {
                            googleMeetLink: googleMeetLink ?? workshop.googleMeetLink,
                            maxSeats: maxSeats !== undefined ? (maxSeats === '' ? null : parseInt(maxSeats)) : workshop.maxSeats
                        }
                    });
                }

                // 3. Update CourseOffering Questions if provided
                if (questions && Array.isArray(questions)) {
                    // Delete old questions
                    await tx.assessmentQuestion.deleteMany({
                        where: { offeringId: workshop.offeringId }
                    });

                    // Insert new questions safely preserving order
                    for (let i = 0; i < questions.length; i++) {
                        const q = questions[i];
                        await tx.assessmentQuestion.create({
                            data: {
                                offeringId: workshop.offeringId,
                                programType: 'workshop',
                                questionNumber: q.number,
                                questionText: q.text,
                                questionType: q.type,
                                mcqOptions: q.options || [],
                                isActive: true
                            }
                        });
                    }
                }

                return newSession;
            });

            res.status(201).json({ session: result });
        } catch (error) {
            console.error("DEBUG ERROR IN POST /sessions:", error);
            res.status(500).json({ message: "Internal Server Error", error: String(error) });
        }
    })
);


workshopsRouter.patch(
    "/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth?.userId || "");

        if (!tutor) {
            res.status(403).json({ message: "Only tutors can edit workshops" });
            return;
        }

        const { googleMeetLink, maxSeats, scheduledAt } = req.body;

        // Verify ownership and get the latest session
        const workshop = await prisma.workshop.findFirst({
            where: { workshopId: id, tutorId: tutor.tutorId },
            include: {
                offering: {
                    include: {
                        workshopSessions: { orderBy: { sessionNo: 'desc' }, take: 1 }
                    }
                }
            }
        });

        if (!workshop) {
            res.status(404).json({ message: "Workshop not found or access denied" });
            return;
        }

        const latestSession = workshop.offering.workshopSessions[0];

        // Fetch only registrations tied to the *latest* session for notifications
        const currentSessionRegistrations = latestSession ? await prisma.registration.findMany({
            where: {
                offeringId: workshop.offeringId,
                status: 'approved',
                sessionId: latestSession.sessionId
            },
            include: { user: true }
        }) : [];

        const oldMeetLink = workshop.googleMeetLink;
        const oldDate = latestSession?.scheduledAt?.toISOString();
        const newDate = scheduledAt ? new Date(scheduledAt).toISOString() : oldDate;
        const newMeetLink = googleMeetLink ?? oldMeetLink;
        const dateChanged = newDate !== oldDate;
        const linkChanged = newMeetLink !== oldMeetLink;

        // Update Workshop core fields
        await prisma.workshop.update({
            where: { workshopId: id },
            data: {
                ...(googleMeetLink && { googleMeetLink }),
                ...(maxSeats !== undefined && { maxSeats: maxSeats ? parseInt(maxSeats) : null }),
            }
        });

        // Update latest WorkshopSession date
        if (scheduledAt && workshop.offering.workshopSessions[0]) {
            await prisma.workshopSession.update({
                where: { sessionId: workshop.offering.workshopSessions[0].sessionId },
                data: { scheduledAt: new Date(scheduledAt) }
            });
        }

        // Re-notify approved learners if date or link changed
        if ((dateChanged || linkChanged) && currentSessionRegistrations.length > 0) {
            const dateStr = new Date(newDate!).toLocaleString();
            await Promise.all(currentSessionRegistrations.map((reg) =>
                sendEmail({
                    to: reg.email,
                    fromName: "Otto Learn Tutor",
                    subject: `Workshop Update: ${workshop.offering.title} 📅`,
                    text: `Hi ${reg.fullName}, the workshop details have been updated.`,
                    html: `
                    <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                        <h2>Workshop Update 📅</h2>
                        <p>The details for <strong>"${workshop.offering.title}"</strong> have been updated:</p>
                        <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>New Date:</strong> ${dateStr}</p>
                            <p style="margin: 0;"><strong>Join Link:</strong> <a href="${newMeetLink}">${newMeetLink}</a></p>
                        </div>
                        <p>Please update your calendar and join on time!</p>
                        <hr />
                        <p style="font-size: 12px; color: #888;">This is an automated email from Otto Learn.</p>
                    </div>
                `
                })
            ));
        }

        res.status(200).json({ message: "Workshop updated successfully" });
    })
);


workshopsRouter.get(
    "/",
    requireAuth,
    asyncHandler(async (req, res) => {
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth?.userId || "");

        if (!tutor) {
            res.status(403).json({ message: "Access denied" });
            return;
        }

        // 1. Get explicit workshops assigned to this tutor
        const assignedWorkshops = await prisma.workshop.findMany({
            where: { tutorId: tutor.tutorId },
            include: {
                offering: {
                    include: {
                        _count: {
                            select: { registrations: { where: { status: 'pending' } } }
                        },
                        workshopSessions: {
                            orderBy: { scheduledAt: 'desc' },
                            take: 1
                        }
                    }
                }
            }
        });

        const formalWorkshopIds = assignedWorkshops.map(w => w.workshopId);
        const formalOfferingIds = assignedWorkshops.map(w => w.offeringId);

        // 2. Get courses owned by this tutor to find "Marketing" workshops (unassigned offerings)
        const myCourses = await prisma.courseTutor.findMany({
            where: { tutorId: tutor.tutorId },
            select: { courseId: true }
        });
        const myCourseIds = myCourses.map(c => c.courseId);

        // 3. Find offerings that belong to my courses but aren't formally started as a 'Workshop' record yet
        const marketingOfferings = await prisma.courseOffering.findMany({
            where: {
                courseId: { in: myCourseIds },
                programType: 'workshop',
                offeringId: { notIn: formalOfferingIds }
            },
            include: {
                _count: {
                    select: { registrations: { where: { status: 'pending' } } }
                },
                workshopSessions: {
                    orderBy: { scheduledAt: 'desc' },
                    take: 1
                }
            }
        });

        // 4. Transform marketing offerings into a 'Workshop-like' structure for the frontend
        const virtualWorkshops = marketingOfferings.map(offering => ({
            workshopId: offering.offeringId, // Use offeringId as a virtual workshopId
            offeringId: offering.offeringId,
            tutorId: tutor.tutorId,
            googleMeetLink: null,
            maxSeats: null,
            type: 'marketing',
            offering: {
                ...offering,
                _count: { registrations: offering._count.registrations }
            }
        }));

        // 5. Merge and return
        const allWorkshops = [
            ...assignedWorkshops.map(w => ({ ...w, type: 'formal' })),
            ...virtualWorkshops
        ];

        res.status(200).json({ workshops: allWorkshops });
    })
);

// GET Workshop Detail
workshopsRouter.get(
    "/:id",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth?.userId || "");

        // Try formal workshop first
        let workshop: any = await prisma.workshop.findFirst({
            where: {
                workshopId: id,
                tutorId: tutor?.tutorId
            },
            include: {
                offering: {
                    include: {
                        questions: true,
                        workshopSessions: {
                            orderBy: { sessionNo: 'desc' }
                        },
                        _count: {
                            select: { registrations: true }
                        }
                    }
                }
            }
        });

        // If not found, try as a virtual (marketing) workshop using offeringId
        if (!workshop) {
            const offering = await prisma.courseOffering.findFirst({
                where: {
                    offeringId: id,
                    course: {
                        tutors: {
                            some: { tutorId: tutor?.tutorId }
                        }
                    }
                },
                include: {
                    questions: true,
                    workshopSessions: {
                        orderBy: { sessionNo: 'desc' }
                    },
                    _count: {
                        select: { registrations: true }
                    }
                }
            });

            if (offering) {
                workshop = {
                    workshopId: offering.offeringId,
                    offeringId: offering.offeringId,
                    tutorId: tutor?.tutorId,
                    googleMeetLink: null,
                    maxSeats: null,
                    type: 'marketing',
                    offering
                };
            }
        }

        if (!workshop) {
            res.status(404).json({ message: "Workshop not found" });
            return;
        }

        res.status(200).json({ workshop });
    })
);

// MANAGE Questions
workshopsRouter.post(
    "/:id/questions",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { questions } = req.body; // Array of { text, type, options, number }
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth?.userId || "");

        const workshop = await prisma.workshop.findFirst({
            where: { workshopId: id, tutorId: tutor?.tutorId }
        });

        if (!workshop) {
            res.status(404).json({ message: "Workshop not found" });
            return;
        }

        // Delete old questions if any (re-sync)
        await prisma.assessmentQuestion.deleteMany({
            where: { offeringId: workshop.offeringId }
        });

        // Bulk create using native Prisma now that ENUMs are mapped safely
        await prisma.assessmentQuestion.createMany({
            data: questions.map((q: any) => ({
                offeringId: workshop.offeringId,
                programType: 'workshop',
                questionNumber: q.number,
                questionText: q.text,
                questionType: q.type, // 'mcq' or 'text'
                mcqOptions: q.options,
                isActive: true
            }))
        });

        res.status(200).json({ message: "Questions updated" });
    })
);

// LIST Registrations
workshopsRouter.get(
    "/:id/registrations",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { sessionId } = req.query;
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth?.userId || "");

        // Resolve offeringId from either workshopId or offeringId
        let offeringId = id;
        const workshop = await prisma.workshop.findFirst({
            where: { workshopId: id, tutorId: tutor?.tutorId }
        });
        
        if (workshop) {
            offeringId = workshop.offeringId;
        } else {
            // Verify tutor has access to the course of this offering
            const offering = await prisma.courseOffering.findFirst({
                where: {
                    offeringId: id,
                    course: {
                        tutors: { some: { tutorId: tutor?.tutorId } }
                    }
                }
            });
            if (!offering) {
                res.status(404).json({ message: "Workshop or offering not found" });
                return;
            }
            offeringId = offering.offeringId;
        }

        const registrations = await prisma.registration.findMany({
            where: {
                offeringId: offeringId,
                ...(sessionId && {
                    OR: [
                        { sessionId: String(sessionId) },
                        { sessionId: null }
                    ]
                })
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ registrations });
    })
);

// APPROVE/REJECT Lead
workshopsRouter.patch(
    "/:id/registrations/:regId",
    requireAuth,
    asyncHandler(async (req, res) => {
        const { id, regId } = req.params;
        const { status, customEmail } = req.body; // 'approved' | 'rejected' | 'customEmail' (optional HTML)
        const auth = (req as AuthenticatedRequest).auth;
        const tutor = await getTutor(auth?.userId || "");

        // 1. Resolve Workshop/Offering
        let workshop: any = await prisma.workshop.findFirst({
            where: { workshopId: id, tutorId: tutor?.tutorId },
            include: {
                offering: {
                    include: {
                        workshopSessions: { orderBy: { scheduledAt: 'desc' }, take: 1 }
                    }
                }
            }
        });

        if (!workshop) {
            // Check if it's a virtual/marketing workshop
            const offering = await prisma.courseOffering.findFirst({
                where: {
                    offeringId: id,
                    course: { tutors: { some: { tutorId: tutor?.tutorId } } }
                },
                include: {
                    workshopSessions: { orderBy: { scheduledAt: 'desc' }, take: 1 }
                }
            });
            if (offering) {
                workshop = {
                    workshopId: offering.offeringId,
                    offeringId: offering.offeringId,
                    tutorId: tutor?.tutorId,
                    googleMeetLink: null,
                    offering
                };
            }
        }

        if (!workshop) {
            res.status(404).json({ message: "Workshop not found" });
            return;
        }

        // 2. Update Registration
        const registration = await prisma.registration.update({
            where: { registrationId: regId },
            data: { status }
        });

        // 3. Send Email (Custom or Default)
        if (status === 'approved') {
            const session = workshop.offering.workshopSessions[0];
            const dateStr = session ? new Date(session.scheduledAt).toLocaleString() : 'TBD';
            
            const subject = `Seat Confirmed: ${workshop.offering.title} 🎉`;
            const defaultHtml = `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <h2>Congratulations! 🎉</h2>
                    <p>Your application for the workshop <strong>"${workshop.offering.title}"</strong> has been approved.</p>
                    <div style="background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Date:</strong> ${dateStr}</p>
                        <p style="margin: 0;"><strong>Join Link:</strong> <a href="${workshop.googleMeetLink}">${workshop.googleMeetLink}</a></p>
                    </div>
                    <p>Please make sure to join on time. See you there!</p>
                    <hr />
                    <p style="font-size: 12px; color: #888;">This is an automated email from Otto Learn.</p>
                </div>
            `;

            await sendEmail({
                to: registration.email,
                fromName: "Otto Learn Tutor",
                subject: subject,
                text: customEmail ? "Your application has been approved. Please see the HTML version of this email for details." : `Hi ${registration.fullName}, your seat for the workshop "${workshop.offering.title}" is confirmed.`,
                html: customEmail || defaultHtml
            });
        }

        res.status(200).json({ registration });
    })
);
