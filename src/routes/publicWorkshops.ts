import express from "express";
import { getWorkshopQuestions, registerForWorkshop } from "../services/publicWorkshopService.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

export const publicWorkshopsRouter = express.Router();

// GET Questions for Registration
publicWorkshopsRouter.get(
    "/:offeringId/questions",
    asyncHandler(async (req, res) => {
        const { offeringId } = req.params;

        const questions = await getWorkshopQuestions(offeringId);

        if (!questions || questions.length === 0) {
            res.status(404).json({ message: "No questions found for this workshop" });
            return;
        }

        res.status(200).json({ questions });
    })
);

// SUBMIT Registration (Lead)
publicWorkshopsRouter.post(
    "/:offeringId/register",
    asyncHandler(async (req, res) => {
        const { offeringId } = req.params;
        const { fullName, email, phoneNumber, answers, collegeName, yearOfPassing, branch } = req.body;

        // Create registration row via service
        const registration = await registerForWorkshop(offeringId, {
            fullName,
            email,
            phoneNumber,
            answers,
            collegeName,
            yearOfPassing,
            branch
        });

        res.status(201).json({
            message: "Registration submitted successfully",
            registrationId: registration.registrationId
        });
    })
);
