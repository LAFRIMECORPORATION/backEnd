// ============================================================
// LAUNCHPAD — feed/feed.service.js
// Fil d'actualités personnalisé
// ============================================================

import prisma from "../../config/database.js";

export const FEED_FILTERS = ["all", "projects", "investments", "forum", "collaborations", "badges"];

export async function getFeed(userId, { filter = "all", page = 1, limit = 20, unreadOnly = false }) {
  const skip  = (page - 1) * limit;

  // Mapping filter vers les valeurs enum FeedEventType
  const eventTypeMap = {
    projects: ["project_published", "project_approved", "project_rejected", "project_removed", "project_funded", "project_view"],
    investments: ["investment_made"],
    forum: [],
    collaborations: ["collaboration_formed"],
    badges: ["badge_earned"],
  };

  const where = {
    ...(filter !== "all" && eventTypeMap[filter] ? { 
      eventType: { in: eventTypeMap[filter] } 
    } : {}),
    AND: [{
      OR: [
        { eventType: { notIn: ["project_published", "project_approved", "project_rejected", "project_removed", "project_funded", "project_view"] } },
        { eventType: { in: ["project_published", "project_funded", "project_view", "project_approved"] }, project: { status: { in: ["active", "funded"] } } },
        { eventType: { in: ["project_rejected", "project_removed"] } },
      ],
    }],
  };

  const readFilter = unreadOnly ? { reads: { none: { userId } } } : {};
  const feedWhere = { ...where, ...readFilter };

  const [events, total] = await Promise.all([
    prisma.feedEvent.findMany({
      where: feedWhere,
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
        reads: {
          where: { userId },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.feedEvent.count({ where: feedWhere }),
  ]);

  const unreadCount = await prisma.feedEvent.count({
    where: { ...where, reads: { none: { userId } } },
  });

  return {
    events: events.map(({ reads, ...event }) => ({ ...event, isRead: reads.length > 0 })),
    total,
    unreadCount,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function markEventRead(userId, eventId) {
  await prisma.feedEventRead.upsert({
    where: { userId_eventId: { userId, eventId } },
    update: { readAt: new Date() },
    create: { userId, eventId },
  });
  return { read: true };
}

export async function markAllEventsRead(userId) {
  const unreadEvents = await prisma.feedEvent.findMany({
    where: { reads: { none: { userId } } },
    select: { id: true },
  });

  if (unreadEvents.length > 0) {
    await prisma.feedEventRead.createMany({
      data: unreadEvents.map(({ id }) => ({ userId, eventId: id })),
      skipDuplicates: true,
    });
  }

  return { updated: unreadEvents.length };
}