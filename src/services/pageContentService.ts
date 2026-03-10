import { prisma } from "./prisma";
import type { PageContent } from "@prisma/client";

export async function getPageBySlug(slug: string): Promise<PageContent | null> {
    return prisma.pageContent.findUnique({
        where: { slug },
    });
}
