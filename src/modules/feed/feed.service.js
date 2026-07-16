// ============================================================
// LAUNCHPAD — feed/feed.service.js
// Fil d'actualités personnalisé
// ============================================================

import prisma from "../../config/database.js";

export const FEED_FILTERS = ["all", "projects", "investments", "forum", "collaborations", "badges"];

export async function getFeed(userId, { filter = "all", page = 1, limit = 20 }) {
  const skip  = (page - 1) * limit;

  // Mapping filter vers les valeurs enum FeedEventType
  const eventTypeMap = {
    projects: ["project_published", "project_funded", "project_view"],
    investments: ["investment_made"],
    forum: [],
    collaborations: ["collaboration_formed"],
    badges: ["badge_earned"],
  };

  const where = {
    ...(filter !== "all" && eventTypeMap[filter] ? { 
      eventType: { in: eventTypeMap[filter] } 
    } : {}),
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
            id: true, firstName: true, lastName: true, avatarUrl: true,
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