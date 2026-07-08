// ============================================================
// LAUNCHPAD — feed/feed.service.js
// Fil d'actualités personnalisé
// ============================================================

import prisma from "../../config/database.js";

export const FEED_FILTERS = ["all", "projects", "investments", "forum", "collaborations", "badges"];

export async function getFeed(userId, { filter = "all", page = 1, limit = 20 }) {
  const skip  = (page - 1) * limit;

  const where = {
    ...(filter !== "all" ? { eventType: { startsWith: filter === "projects" ? "project" : filter === "investments" ? "investment" : filter === "forum" ? "forum" : filter === "badges" ? "badge" : "collaboration" } } : {}),
    // Ne pas montrer ses propres actions dans certains cas
    NOT: filter === "all" ? [] : [],
  };

  const [events, total] = await Promise.all([
    prisma.feedEvent.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:         true,
        eventType:  true,
        entityType: true,
        entityId:   true,
        metadata:   true,
        createdAt:  true,
        actor: {
          select: {
            id: true, firstName: true, lastName: true,
            profile: { select: { avatarUrl: true } },
          },
        },
        project: {
          select: { id: true, title: true, category: true, coverImageUrl: true },
        },
      },
    }),
    prisma.feedEvent.count({ where }),
  ]);

  return { events, total, page, totalPages: Math.ceil(total / limit) };
}