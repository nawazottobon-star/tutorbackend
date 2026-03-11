import { prisma } from "./prisma.js";

const LEGACY_COURSE_SLUGS: Record<string, string> = {
    "ai-in-web-development": "f26180b2-5dda-495a-a014-ae02e63f172f",
};

export function normalizeVideoUrl(url: string | null | undefined): string | null {
    if (!url) {
        return null;
    }
    const trimmed = url.trim();
    if (!trimmed) {
        return null;
    }

    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();

        const toEmbed = (id: string | null) => (id ? `https://www.youtube.com/embed/${id}` : trimmed);

        if (host.includes("youtube.com")) {
            if (parsed.pathname.startsWith("/embed/")) {
                return `https://www.youtube.com${parsed.pathname}`;
            }
            if (parsed.pathname === "/watch") {
                return toEmbed(parsed.searchParams.get("v"));
            }
            if (parsed.pathname.startsWith("/shorts/")) {
                return toEmbed(parsed.pathname.split("/").pop() ?? null);
            }
        }
        if (host === "youtu.be") {
            const id = parsed.pathname.replace(/^\/+/, "");
            return toEmbed(id || null);
        }

        return trimmed;
    } catch {
        return trimmed;
    }
}

export const mapTopicForResponse = <T extends { videoUrl: string | null | undefined }>(topic: T) => ({
    ...topic,
    videoUrl: normalizeVideoUrl(topic.videoUrl),
});


export async function resolveCourseId(courseKey: string): Promise<string | null> {
    const trimmedKey = courseKey?.trim();
    if (!trimmedKey) {
        return null;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(trimmedKey)) {
        return trimmedKey;
    }

    let decodedKey: string;
    try {
        decodedKey = decodeURIComponent(trimmedKey).trim();
    } catch {
        decodedKey = trimmedKey;
    }

    const normalizedSlug = decodedKey.toLowerCase();
    const aliasMatch = LEGACY_COURSE_SLUGS[normalizedSlug];
    if (aliasMatch) {
        return aliasMatch;
    }

    const normalizedName = decodedKey.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
    const searchNames = Array.from(
        new Set(
            [decodedKey, normalizedName]
                .map((value) => value.trim())
                .filter((value) => value.length > 0),
        ),
    );

    if (searchNames.length === 0) {
        return null;
    }

    const course = await prisma.course.findFirst({
        where: {
            OR: searchNames.map((name) => ({
                courseName: {
                    equals: name,
                    mode: "insensitive",
                },
            })),
        },
        select: { courseId: true },
    });

    return course?.courseId ?? null;
}

export async function getTopicsByModuleNo(moduleNo: number) {
    const topics = await prisma.topic.findMany({
        where: { moduleNo },
        orderBy: { topicNumber: "asc" },
        select: {
            topicId: true,
            courseId: true,
            moduleNo: true,
            moduleName: true,
            topicNumber: true,
            topicName: true,
            pptUrl: true,
            videoUrl: true,
            textContent: true,
            textContentSports: true,
            textContentCooking: true,
            textContentAdventure: true,
            isPreview: true,
            contentType: true,
            simulation: { select: { title: true, body: true } },
        },
    });
    return topics.map(mapTopicForResponse);
}

export async function getTopicsByCourseId(courseId: string) {
    const topics = await prisma.topic.findMany({
        where: { courseId },
        orderBy: [{ moduleNo: "asc" }, { topicNumber: "asc" }],
        select: {
            topicId: true,
            courseId: true,
            moduleNo: true,
            moduleName: true,
            topicNumber: true,
            topicName: true,
            pptUrl: true,
            videoUrl: true,
            textContent: true,
            textContentSports: true,
            textContentCooking: true,
            textContentAdventure: true,
            isPreview: true,
            contentType: true,
            simulation: { select: { title: true, body: true } },
        },
    });
    return topics.map(mapTopicForResponse);
}

