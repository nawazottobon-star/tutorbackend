import { prisma } from "./prisma.js";

export async function getWorkshopQuestions(offeringId: string) {
    return prisma.assessmentQuestion.findMany({
        where: {
            offeringId: offeringId,
            isActive: true,
        },
        orderBy: { questionNumber: "asc" },
    });
}

export async function registerForWorkshop(offeringId: string, data: {
    fullName: string;
    email: string;
    phoneNumber?: string;
    answers: any;
    collegeName?: string;
    yearOfPassing?: string;
    branch?: string;
}) {
    return prisma.registration.create({
        data: {
            offeringId,
            fullName: data.fullName,
            email: data.email,
            phoneNumber: data.phoneNumber || "",
            collegeName: data.collegeName || "N/A",
            yearOfPassing: data.yearOfPassing || "N/A",
            branch: data.branch || "N/A",
            status: "pending",
            answersJson: data.answers,
            updatedAt: new Date(),
        },
    });
}
