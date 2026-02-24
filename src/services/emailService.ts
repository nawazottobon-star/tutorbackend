import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: env.platformEmail,
        pass: env.platformEmailPassword,
    },
});

interface SendEmailOptions {
    to: string | string[];
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    fromName: string;
}

/**
 * Sends an email using the platform's SMTP credentials.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, text, html, replyTo, fromName } = options;

    const mailOptions = {
        from: `"${fromName}" <${env.platformEmail}>`,
        to: Array.isArray(to) ? to.join(", ") : to,
        replyTo: replyTo,
        subject: subject,
        text: text,
        html: html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
        throw new Error("Failed to send email");
    }
}
