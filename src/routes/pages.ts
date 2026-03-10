import express from "express";
import { getPageBySlug } from "../services/pageContentService";
import { asyncHandler } from "../shared/utils/asyncHandler";

const pagesRouter = express.Router();

pagesRouter.get(
  "/:slug",
  asyncHandler(async (req, res) => {
    const slug = req.params.slug?.trim().toLowerCase();
    if (!slug) {
      res.status(400).json({ message: "Page slug is required" });
      return;
    }

    const page = await getPageBySlug(slug);

    if (!page) {
      res.status(404).json({ message: "Page not found" });
      return;
    }

    res.status(200).json({
      page: {
        slug: page.slug,
        title: page.title,
        subtitle: page.subtitle,
        heroImage: page.heroImage,
        sections: page.sections,
        updatedAt: page.updatedAt.toISOString(),
      },
    });
  }),
);

export { pagesRouter };
