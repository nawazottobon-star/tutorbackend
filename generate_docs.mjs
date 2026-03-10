import {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, AlignmentType,
    BorderStyle, ShadingType, convertInchesToTwip
} from "docx";
import fs from "fs";

const BLUE = "2563EB";
const LIGHT_BLUE = "EFF6FF";
const DARK = "1E293B";
const GRAY = "64748B";
const WHITE = "FFFFFF";

function heading1(text) {
    return new Paragraph({
        text,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        run: { color: BLUE, bold: true },
    });
}

function heading2(text) {
    return new Paragraph({
        text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
    });
}

function heading3(text) {
    return new Paragraph({
        text,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
    });
}

function para(text, opts = {}) {
    return new Paragraph({
        children: [new TextRun({ text, size: 22, color: opts.color || DARK, bold: opts.bold || false })],
        spacing: { after: 150 },
    });
}

function bullet(text) {
    return new Paragraph({
        text,
        bullet: { level: 0 },
        spacing: { after: 80 },
        style: "ListParagraph",
        run: { size: 22 },
    });
}

function subBullet(text) {
    return new Paragraph({
        text,
        bullet: { level: 1 },
        spacing: { after: 60 },
        style: "ListParagraph",
        run: { size: 21 },
    });
}

function divider() {
    return new Paragraph({
        border: { bottom: { color: "DBEAFE", space: 1, value: BorderStyle.SINGLE, size: 6 } },
        spacing: { after: 200 },
    });
}

function tableHeader(texts) {
    return new TableRow({
        children: texts.map(t => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: WHITE, size: 20 })], alignment: AlignmentType.CENTER })],
            shading: { fill: BLUE, type: ShadingType.CLEAR, color: "auto" },
        })),
        tableHeader: true,
    });
}

function tableRow(cells) {
    return new TableRow({
        children: cells.map(t => new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: t, size: 20, color: DARK })] })],
            shading: { fill: LIGHT_BLUE, type: ShadingType.CLEAR, color: "auto" },
        })),
    });
}

// ===========================
// REQUIREMENTS DOCUMENT
// ===========================
const reqDoc = new Document({
    creator: "Otto Learn",
    title: "Course Submission Wizard - Requirements Document",
    description: "Requirements specification for the Course Submission Wizard feature.",
    styles: {
        default: {
            document: { run: { font: "Calibri", size: 22, color: DARK } },
        },
    },
    sections: [{
        properties: {},
        children: [
            // Title Block
            new Paragraph({
                children: [new TextRun({ text: "Course Submission Wizard", bold: true, size: 56, color: BLUE })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
            }),
            new Paragraph({
                children: [new TextRun({ text: "Requirements Specification Document", size: 28, color: GRAY })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
            }),
            new Paragraph({
                children: [new TextRun({ text: "Product: Otto Learn Platform  |  Date: 06-Mar-2026  |  Version: 1.0", size: 20, color: GRAY, italics: true })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
            }),
            divider(),

            // 1. Overview
            heading1("1. Project Overview"),
            para("The Course Submission Wizard is a dedicated frontend flow that enables tutors on the Otto Learn platform to formally propose a new course. It serves as the primary interface between a tutor's content idea and the internal content team's review process."),
            para("The feature replaces a previous manual or email-based process with a structured, multi-step digital form that captures all information required for a course to be evaluated, designed, and published."),
            divider(),

            // 2. Business Problem
            heading1("2. Business Problem & Goals"),
            heading2("2.1 Problem Statement"),
            para("Before this feature, new tutors had no guided path to propose a course after signing up. They were directed to an empty dashboard, leading to confusion and high drop-off rates among new content creators."),

            heading2("2.2 Business Goals"),
            bullet("Reduce tutor onboarding friction by providing an automated and guided first-time experience."),
            bullet("Standardize the course proposal data received by the content team."),
            bullet("Enable the system to automatically distinguish between a 'new tutor' (no courses) and an 'active tutor' (has courses)."),
            bullet("Support the India market with INR (₹) pricing and en-IN number formatting."),
            divider(),

            // 3. Scope
            heading1("3. Scope & Boundaries"),
            heading2("3.1 In Scope"),
            bullet("Tutor authentication gate — only authenticated 'tutor' role users may access the wizard."),
            bullet("Automatic redirection of new tutors (with 0 active courses) to the wizard upon login."),
            bullet("A 7-step sequential form wizard for course proposal creation."),
            bullet("File upload (PDFs, DOCX) and video link management."),
            bullet("INR pricing with a discount-aware estimated launch price calculator."),
            bullet("AI provider configuration (OpenAI, Gemini, Anthropic, etc.)."),
            bullet("Submission storage in the backend database (course_submissions table)."),
            bullet("A 'My Proposals' view to let tutors track status of their submissions."),

            heading2("3.2 Out of Scope"),
            bullet("Content team review workflow (admin portal — separate feature)."),
            bullet("Automatic course publication (requires manual content team approval)."),
            bullet("Payment gateway integration for tutor payouts."),
            divider(),

            // 4. Stakeholders
            heading1("4. Stakeholders"),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    tableHeader(["Stakeholder", "Role", "Impact"]),
                    tableRow(["Tutors", "Primary Users", "Directly use the wizard to submit proposals"]),
                    tableRow(["Content Team", "Consumers", "Receive structured proposals for review"]),
                    tableRow(["Database Team", "Infrastructure", "Create and maintain required DB tables"]),
                    tableRow(["Platform Admins", "Operators", "Monitor submissions via admin dashboard"]),
                    tableRow(["Engineering Team", "Builders", "Develop and maintain the feature"]),
                ],
            }),
            new Paragraph({ spacing: { after: 200 } }),
            divider(),

            // 5. Functional Requirements
            heading1("5. Functional Requirements"),

            heading2("FR-01: Intelligent Login Routing"),
            bullet("On successful login, the system MUST check if the tutor has any active course assignments."),
            bullet("If course count = 0: redirect the tutor to /course-submission-wizard."),
            bullet("If course count > 0: redirect the tutor to /tutors (Dashboard)."),
            bullet("Dashboard MUST also have a fallback check to re-route if a tutor has no courses."),

            heading2("FR-02: Access Control"),
            bullet("Only authenticated users with the role 'tutor' may access the wizard."),
            bullet("Unauthenticated users must be redirected to the login page."),
            bullet("Users with the 'learner' or 'admin' role must be shown a restricted access message."),

            heading2("FR-03: The 7-Step Wizard"),
            para("The wizard must be sequential. A tutor cannot skip steps."),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    tableHeader(["Step", "Title", "Fields Collected"]),
                    tableRow(["1", "Course Info", "Course Name, Description, Target Audience, Category"]),
                    tableRow(["2", "Planned Structure", "Number of Modules (1–50)"]),
                    tableRow(["3", "Pricing", "Standard Price (₹), Sale Price (₹), Discount %"]),
                    tableRow(["4", "AI Setup", "API Key Provider, API Key, API Key Hint"]),
                    tableRow(["5", "Course Materials", "File uploads (PDF, DOCX, etc.)"]),
                    tableRow(["6", "Video References", "YouTube/Video URLs"]),
                    tableRow(["7", "Review & Submit", "Full preview before submission"]),
                ],
            }),
            new Paragraph({ spacing: { after: 200 } }),

            heading2("FR-04: Category Selection"),
            para("The wizard must provide a predefined list of course categories. As of v1.0, these are:"),
            bullet("Fullstack Development, Frontend Development, Backend Development"),
            bullet("Artificial Intelligence, Machine Learning, Data Science, Data Analytics"),
            bullet("Cloud Computing, DevOps & CI/CD, Cybersecurity"),
            bullet("Mobile App Development (Android/iOS), Blockchain & Web3"),
            bullet("UI/UX Design, Digital Marketing, Product Management"),
            bullet("Finance & Fintech, Others"),

            heading2("FR-05: Pricing Behaviour"),
            bullet("Currency must be displayed in Indian Rupee (₹)."),
            bullet("When a price input is clicked, the entire value must be selected for immediate re-entry."),
            bullet("The Estimated Launch Price must be auto-calculated as: Standard Price × (1 - Discount% / 100)."),
            bullet("Prices must be formatted with en-IN locale (e.g., ₹1,00,000)."),

            heading2("FR-06: Module Count Input"),
            bullet("Must have visible '+' and '-' increment/decrement buttons (NOT hidden behind hover)."),
            bullet("Range must be enforced: minimum 1, maximum 50."),
            bullet("The input value must be selectable on click for direct number entry."),

            heading2("FR-07: My Proposals View"),
            bullet("If a tutor has already submitted proposals, they land on 'My Proposals' instead of the wizard."),
            bullet("Each proposal card must show: Course Name, Module Count, Category, Date, Status."),
            bullet("A '∨' button on each card must expand to show full details: Pricing, Files, Videos, Target Audience, AI Config."),
            bullet("A 'Create Another Course' button must be available."),
            bullet("A 'Back to Dashboard' button must be visible at the top-left."),

            heading2("FR-08: Session & Logout"),
            bullet("The logout button in the header must always work, clearing local storage and JWT tokens."),
            bullet("Logout must redirect the user to the homepage (/)."),
            divider(),

            // 6. Non-Functional Requirements
            heading1("6. Non-Functional Requirements"),
            bullet("Performance: Each wizard step must render in under 300ms on a standard 4G connection."),
            bullet("Security: API calls must include a valid JWT Bearer token in the Authorization header."),
            bullet("Compatibility: Must work on Chrome, Firefox, Edge (latest versions)."),
            bullet("Responsiveness: Must be fully usable on screens 375px wide and above."),
            bullet("Localisation: All currency values must use en-IN formatting with ₹ symbol."),
            divider(),

            // 7. Acceptance Criteria
            heading1("7. Acceptance Criteria"),
            bullet("A newly signed-up tutor sees the wizard immediately upon first login — NOT the dashboard."),
            bullet("The category dropdown shows a non-empty default value ('Fullstack Development') on load."),
            bullet("Typing a number in the price field immediately replaces the old value (no cursor positioning needed)."),
            bullet("The +/- module buttons are visible without requiring any mouse hover."),
            bullet("The 'My Proposals' expand button reveals pricing, files, and videos correctly."),
            bullet("The logout button successfully clears the session and redirects to / from any page."),
            bullet("Submitting a proposal with no file uploads or video links is permitted (they are optional)."),
        ],
    }],
});

// ===========================
// DESIGN DOCUMENT
// ===========================
const designDoc = new Document({
    creator: "Otto Learn Engineering",
    title: "Course Submission Wizard - Design Document",
    styles: {
        default: {
            document: { run: { font: "Calibri", size: 22, color: DARK } },
        },
    },
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                children: [new TextRun({ text: "Course Submission Wizard", bold: true, size: 56, color: BLUE })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
            }),
            new Paragraph({
                children: [new TextRun({ text: "Technical Design Document", size: 28, color: GRAY })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
            }),
            new Paragraph({
                children: [new TextRun({ text: "Product: Otto Learn Platform  |  Date: 06-Mar-2026  |  Version: 1.0", size: 20, color: GRAY, italics: true })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
            }),
            divider(),

            // 1. System Architecture
            heading1("1. System Architecture Overview"),
            para("The Course Submission Wizard follows a 3-layer architecture as standardised across the Otto Learn platform:"),
            bullet("Layer 1 – UI Layer (React/Vite): CourseSubmissionWizardPage.tsx renders the multi-step wizard and manages all form state locally using React useState."),
            bullet("Layer 2 – Binding Layer (API Client): apiRequest() from queryClient.ts and getAuthHeaders() from session.ts abstract all HTTP communication."),
            bullet("Layer 3 – API Layer (Express + Prisma): courseSubmissions.ts router handles business logic validation and writes to the PostgreSQL database."),
            divider(),

            // 2. Routing & Auth Flow
            heading1("2. Authentication & Routing Flow"),
            heading2("2.1 Login Decision Tree"),
            para("The routing logic is implemented in TutorDashboardPage.tsx and reacts to the result of GET /api/tutors/me/courses."),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    tableHeader(["Condition", "Action", "Route"]),
                    tableRow(["User is not authenticated", "Show error / redirect", "/"]),
                    tableRow(["User has role 'learner'", "Show 'Access Restricted' UI", "/tutors"]),
                    tableRow(["User is tutor, 0 courses", "Redirect to wizard", "/course-submission-wizard"]),
                    tableRow(["User is tutor, >0 courses", "Show Dashboard", "/tutors"]),
                ],
            }),
            new Paragraph({ spacing: { after: 200 } }),

            heading2("2.2 Session Management"),
            bullet("Tokens stored in: localStorage (accessToken, refreshToken)."),
            bullet("Auth headers injected by: getAuthHeaders() in src/utils/session.ts."),
            bullet("Logout handled by: logoutAndRedirect() — clears all localStorage keys and navigates to /."),
            divider(),

            // 3. Frontend Design
            heading1("3. Frontend Component Design"),
            heading2("3.1 Key File"),
            para("Path: src/pages/CourseSubmissionWizardPage.tsx"),

            heading2("3.2 State Management"),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    tableHeader(["State Variable", "Type", "Purpose"]),
                    tableRow(["currentStep", "number (1-7)", "Controls which wizard step is rendered"]),
                    tableRow(["formData", "object", "Holds all form field values"]),
                    tableRow(["isCreatingNew", "boolean", "Forces wizard view even if submissions exist"]),
                    tableRow(["expandedSubmissionId", "string | null", "Controls expanded proposal card in list view"]),
                    tableRow(["isSubmitting", "boolean", "Disables submit button during API call"]),
                    tableRow(["videoInput", "string", "Controlled input for adding new video URL"]),
                ],
            }),
            new Paragraph({ spacing: { after: 200 } }),

            heading2("3.3 Rendering States"),
            para("The component renders one of four views based on current state:"),
            bullet("Loading State: Shows a spinner while submissions are being fetched."),
            bullet("List View (My Proposals): Shown when submissions.length > 0 && !isCreatingNew."),
            bullet("Wizard View: Shown for new tutors or when isCreatingNew = true."),
            bullet("Restricted View: Shown when the authenticated user is not a tutor."),

            heading2("3.4 Wizard Steps Detail"),
            para("Step 1 — Course Info: courseName (required), description (required), targetAudience (required), category (Select from predefined list, default: 'Fullstack Development')."),
            para("Step 2 — Planned Structure: moduleCount (number, min 1, max 50). +/- buttons and direct number entry. Input auto-selects on focus."),
            para("Step 3 — Pricing: priceHigh (₹, float), priceLow (₹, float), discountPercent (integer, 0-100). Live estimated price calculation."),
            para("Step 4 — AI Setup: apiKeyProvider (Select: openai, gemini, anthropic, cohere, mistral), apiKeyEncrypted (text), apiKeyHint (text)."),
            para("Step 5 — Materials: File picker (accepts .pdf, .doc, .docx, .ppt). Files stored as {name, url, type}[]."),
            para("Step 6 — Videos: Text input to add YouTube/video URLs one at a time. Each can be deleted individually."),
            para("Step 7 — Review: Renders a full read-only summary of all data before submission."),
            divider(),

            // 4. Backend API Design
            heading1("4. Backend API Design"),
            heading2("4.1 Route File"),
            para("Path: src/routes/courseSubmissions.ts"),

            heading2("4.2 Endpoints"),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    tableHeader(["Method", "Route", "Auth Required", "Description"]),
                    tableRow(["POST", "/api/course-submissions", "Yes (Tutor)", "Create a new course proposal"]),
                    tableRow(["GET", "/api/course-submissions/me", "Yes (Tutor)", "Fetch all submissions for logged-in tutor"]),
                ],
            }),
            new Paragraph({ spacing: { after: 200 } }),

            heading2("4.3 POST Payload Schema (Zod-Validated)"),
            new Paragraph({
                children: [new TextRun({
                    text: [
                        "courseName: string (required)",
                        "description: string (required)",
                        "targetAudience: string (required)",
                        "category: string (required, default: 'General')",
                        "moduleCount: integer (min 1, required)",
                        "priceHigh: number (min 0)",
                        "priceLow: number (min 0, must be <= priceHigh)",
                        "discountPercent: integer (0-100)",
                        "apiKeyProvider: string (optional)",
                        "apiKeyEncrypted: string (optional)",
                        "apiKeyHint: string (optional)",
                        "uploadedDocuments: [{name, url, type}] (default: [])",
                        "videoLinks: string[] (default: [])",
                    ].join("\n"),
                    font: "Courier New",
                    size: 18,
                    color: "1E3A5F",
                })],
                shading: { fill: "F0F7FF", type: ShadingType.CLEAR },
                spacing: { after: 200 },
            }),

            heading2("4.4 Business Rule"),
            para("The backend enforces: priceLow MUST be <= priceHigh. If violated, a 400 error is returned."),
            divider(),

            // 5. Database Schema
            heading1("5. Database Schema"),
            heading2("5.1 Table: course_submissions"),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    tableHeader(["Column", "Type", "Notes"]),
                    tableRow(["submission_id", "UUID (PK)", "Auto-generated"]),
                    tableRow(["tutor_id", "UUID (FK)", "References tutors.tutor_id"]),
                    tableRow(["course_name", "TEXT", "Required"]),
                    tableRow(["description", "TEXT", "Required"]),
                    tableRow(["target_audience", "TEXT", "Required"]),
                    tableRow(["category", "TEXT", "Required"]),
                    tableRow(["module_count", "INTEGER", "Default: 1"]),
                    tableRow(["price_high", "DECIMAL(10,2)", "INR amount"]),
                    tableRow(["price_low", "DECIMAL(10,2)", "INR amount"]),
                    tableRow(["discount_percent", "INTEGER", "0–100"]),
                    tableRow(["uploaded_documents", "JSON", "Array of {name, url, type}"]),
                    tableRow(["video_links", "JSON", "Array of URL strings"]),
                    tableRow(["api_key_provider", "TEXT", "Optional"]),
                    tableRow(["api_key_encrypted", "TEXT", "Optional"]),
                    tableRow(["api_key_hint", "TEXT", "Optional"]),
                    tableRow(["status", "TEXT", "Default: 'draft', values: draft | pending_review | approved | rejected"]),
                    tableRow(["reviewed_by", "UUID (FK)", "References users.user_id — set by admin"]),
                    tableRow(["reviewed_at", "TIMESTAMPTZ", "Nullable"]),
                    tableRow(["created_at", "TIMESTAMPTZ", "Auto"]),
                    tableRow(["updated_at", "TIMESTAMPTZ", "Auto"]),
                ],
            }),
            new Paragraph({ spacing: { after: 300 } }),
            divider(),

            // 6. Pending Items for DB Team
            heading1("6. Pending: Workshop Tables (DB Team Action Required)"),
            para("The Workshop Create feature is fully built in both the frontend (WorkshopCreatePage.tsx) and backend (workshops.ts router) but is currently failing because the following two tables have not yet been created in the production database."),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    tableHeader(["Table Name", "Status", "Depends On"]),
                    tableRow(["workshops", "MISSING — required from DB team", "course_offerings (exists)"]),
                    tableRow(["workshop_sessions", "MISSING — required from DB team", "course_offerings (exists)"]),
                ],
            }),
            new Paragraph({ spacing: { after: 200 } }),
            para("Please refer to the schema.prisma file in the repository for the exact column definitions. The Prisma migration file can be provided on request."),
            divider(),

            // 7. UI Component Library
            heading1("7. UI Component & Icon Reference"),
            heading2("7.1 Component Library"),
            bullet("Base Components: src/components/ui/ (Card, Button, Input, Select, Badge, Label, Textarea, Toast)"),
            bullet("Layout: SiteLayout + SiteHeader — provides the top navigation bar and logout button."),
            bullet("Animations: framer-motion — used for step transitions and expandable card animations."),
            bullet("Styling: Tailwind CSS utility classes with a custom design token system."),

            heading2("7.2 Icons Used (lucide-react)"),
            para("ChevronRight, ChevronDown, ChevronLeft, Check, Upload, Plus, Minus, Trash2, Globe, Layout, IndianRupee, Cpu, FileText, Video, Loader2, Clock, Sparkles"),
            divider(),

            // 8. Future Enhancements
            heading1("8. Future Considerations"),
            bullet("Draft Auto-Save: Periodically save wizard progress to localStorage so tutors don't lose data on refresh."),
            bullet("Admin Review Portal: A parallel UI for content team to approve/reject proposals with a reason field."),
            bullet("Submission Edit: Allow tutors to edit a 'pending_review' submission before it is locked by an admin."),
            bullet("Email Notifications: Trigger automated emails when a submission status changes to 'approved' or 'rejected'."),
            bullet("File Storage: Integrate with a cloud CDN (S3 / Cloudflare R2) for secure, permanent file storage."),
        ],
    }],
});

const outputDir = "C:\\Users\\patha\\OneDrive\\Desktop\\tutor-backup";

const reqBuffer = await Packer.toBuffer(reqDoc);
fs.writeFileSync(`${outputDir}\\CourseWizard_Requirements.docx`, reqBuffer);
console.log("✅ Requirements Document created: CourseWizard_Requirements.docx");

const designBuffer = await Packer.toBuffer(designDoc);
fs.writeFileSync(`${outputDir}\\CourseWizard_Design.docx`, designBuffer);
console.log("✅ Design Document created: CourseWizard_Design.docx");
