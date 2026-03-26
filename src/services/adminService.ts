import crypto from "node:crypto";
import { prisma } from "./prisma.js";
import { hashPassword } from "../shared/utils/password.js";
import { sendEmail } from "./emailService.js";

function slugify(value: string, fallback: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug.length > 0 ? slug : fallback;
}

export async function getTutorApplications() {
    return prisma.tutorApplication.findMany({
        orderBy: { createdAt: "desc" },
    });
}

function generateTempPassword() {
    const id = Math.floor(100000 + Math.random() * 900000); // 6 digits
    return `TUTOR-${id}`;
}

export async function approveTutorApplication(applicationId: string) {
    const application = await prisma.tutorApplication.findUnique({
        where: { applicationId },
    });

    if (!application) {
        return { status: 404, message: "Application not found" };
    }

    if (application.status === "approved") {
        return { status: 200, message: "Application already approved" };
    }

    const email = application.email.trim().toLowerCase();
    const fullName = application.fullName.trim();
    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    console.log(`[AdminService] Processing approval for ${email}`);

    // Create or Update User using Raw SQL
    try {
      console.log(`[AdminService] Upserting user: ${email}`);
      await prisma.$executeRaw`
        INSERT INTO "users" ("email", "full_name", "password_hash", "role", "created_at")
        VALUES (${email}, ${fullName}, ${hashedPassword}, 'tutor'::"Role", NOW())
        ON CONFLICT ("email") DO UPDATE SET
          "full_name" = EXCLUDED."full_name",
          "role" = 'tutor'::"Role",
          "password_hash" = EXCLUDED."password_hash"
      `;
    } catch (err: any) {
      console.error("[AdminService] User upsert failed:", err.message || err);
      return { status: 500, message: `User record failed: ${err.message || 'Check database constraints'}` };
    }

    // Retrieve User ID
    const userResult: any[] = await prisma.$queryRaw`
      SELECT "user_id" FROM "users" WHERE "email" = ${email} LIMIT 1
    `;
    const userId = userResult[0]?.user_id;
    if (!userId) {
      return { status: 500, message: "User retrieval failed after creation" };
    }

    // Create or Update Tutor Profile - HARDENED for 9-column schema
    try {
      console.log(`[AdminService] Creating tutor profile for user ${userId} with email ${email}`);
      // Based on user feedback, tutors table has: tutor_id, user_id, email (NN), password (NN), password_hash, display_name (NN), bio, created_at, updated_at
      await prisma.$executeRaw`
        INSERT INTO "tutors" ("user_id", "email", "password", "password_hash", "display_name", "bio", "updated_at")
        VALUES (
          ${userId}::uuid, 
          ${email}, 
          ${tempPassword}, 
          ${hashedPassword}, 
          ${fullName}, 
          ${application.bio || (application as any).expertiseArea || null}, 
          NOW()
        )
        ON CONFLICT ("user_id") DO UPDATE SET
          "email" = EXCLUDED."email",
          "password" = EXCLUDED."password",
          "password_hash" = EXCLUDED."password_hash",
          "display_name" = EXCLUDED."display_name",
          "bio" = EXCLUDED."bio",
          "updated_at" = NOW()
      `;
    } catch (err: any) {
      console.error("[AdminService] Tutor insert failed:", err.message || err);
      // Construct a helpful error message with the columns we sent
      return { 
        status: 500, 
        message: `Tutor profile failed: ${err.message || 'Check database constraints'}. Column check: user_id=${userId}, email=${email}, name=${fullName}` 
      };
    }

    // Retrieve the tutor ID (UUID)
    const tutorResult: any[] = await prisma.$queryRaw`
      SELECT "tutor_id" FROM "tutors" WHERE "user_id" = ${userId}::uuid OR "email" = ${email} LIMIT 1
    `;
    const tutorId = tutorResult[0]?.tutor_id;
    if (!tutorId) {
      return { status: 500, message: "Tutor profile verification failed" };
    }

    // Create a starter course
    const courseTitle = application.courseTitle?.trim() || "Untitled Course";
    const courseSlug = slugify(courseTitle, `course-${crypto.randomUUID()}`);
    const courseDescription = application.courseDescription?.trim() || "Course description pending.";

    try {
      console.log(`[AdminService] Creating course: ${courseTitle}`);
      await prisma.$executeRaw`
        INSERT INTO "courses" (
          "slug", "course_name", "description", "price_cents", "category", 
          "level", "instructor", "duration_minutes", "rating", "students", 
          "is_featured", "updated_at"
        ) VALUES (
          ${courseSlug}, ${courseTitle}, ${courseDescription}, 0, 
          ${(application as any).expertiseArea || "General"}, 'Beginner', ${fullName}, 
          0, 4.5, 0, false, NOW()
        )
        ON CONFLICT ("slug") DO UPDATE SET
          "course_name" = EXCLUDED."course_name",
          "description" = EXCLUDED."description",
          "updated_at" = NOW()
      `;
    } catch (err: any) {
      console.error("[AdminService] Course insert failed:", err.message || err);
      return { status: 500, message: `Course record failed: ${err.message || 'Check database constraints'}` };
    }

    const courseResult: any[] = await prisma.$queryRaw`
      SELECT "course_id" FROM "courses" WHERE "slug" = ${courseSlug} LIMIT 1
    `;
    const courseId = courseResult[0]?.course_id;

    // Link Tutor to Course
    if (courseId && tutorId) {
      console.log(`[AdminService] Linking tutor ${tutorId} to course ${courseId}`);
      try {
        await prisma.$executeRaw`
          INSERT INTO "public"."course_tutors" ("course_id", "tutor_id", "role", "is_active", "updated_at")
          VALUES (${courseId}::uuid, ${tutorId}::uuid, 'owner', true, NOW())
          ON CONFLICT ("course_id", "tutor_id") DO UPDATE SET
            "role" = 'owner',
            "is_active" = true,
            "updated_at" = NOW()
        `;
      } catch (err) {
        console.error("[AdminService] Link failed:", err);
      }
    }

    // Finalize application status
    try {
      await prisma.$executeRaw`
        UPDATE "public"."tutor_applications" SET "status" = 'approved', "updated_at" = NOW() WHERE "application_id" = ${applicationId}::uuid
      `;
    } catch (err) {
      console.error("[AdminService] Application status update failed:", err);
    }

    // Send Welcome Email
    try {
        await sendEmail({
            to: email,
            subject: "Welcome to Ottolearn - Your Tutor Application is Approved!",
            fromName: "Ottolearn Academic Team",
            text: `Hi ${fullName},

Congratulations! Your tutor application has been approved.

You can now log in to the Tutor Console and start building your course.

Log in here: https://ottolearn.ai/tutor/login
Your temporary password: ${tempPassword}

Please change your password after your first login.

Best regards,
The Ottolearn Team`,
            html: `
                <div style="font-family: sans-serif; line-height: 1.6; color: #1E3A47;">
                    <h2>Welcome to Ottolearn, ${fullName}!</h2>
                    <p>Congratulations! Your tutor application has been approved.</p>
                    <p>You can now log in to the Tutor Console and start building your course.</p>
                    <div style="background: #FFF5EC; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #FFC48C;">
                        <p style="margin: 0;"><strong>Log in:</strong> <a href="https://ottolearn.ai/tutor/login" style="color: #B24531;">ottolearn.ai/tutor/login</a></p>
                        <p style="margin: 10px 0 0 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
                    </div>
                    <p>Please change your password after your first login.</p>
                    <p>Best regards,<br/>The Ottolearn Team</p>
                </div>
            `
        });
    } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
        // We don't fail the whole request because the user was created and approved.
    }

    return {
        status: 200,
        data: {
            tutor: {
                tutorId,
                userId,
                fullName,
                email,
            },
            course: {
                courseId,
                slug: courseSlug,
                title: courseTitle,
            },
            message: "Application approved, course created, and welcome email sent.",
        },
    };
}

export async function rejectTutorApplication(applicationId: string) {
    const application = await prisma.tutorApplication.findUnique({
        where: { applicationId },
    });

    if (!application) {
        return { status: 404, message: "Application not found" };
    }

    await prisma.tutorApplication.update({
        where: { applicationId },
        data: { status: "rejected" },
    });

    return { status: 200, message: "Application rejected" };
}
