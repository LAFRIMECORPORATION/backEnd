// ============================================================
// LAUNCHPAD — notifications/notifications.service.js
// Service notifications minimal — Phase 2 (requis par KYC)
// Version complète en Phase 6
// ============================================================

import prisma from "../../config/database.js";

// ── Créer une notification in-app ─────────────────────────
export async function createNotification({
  userId,
  type,
  title,
  body,
  actionUrl = null,
}) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        actionUrl,
      },
    });
  } catch (error) {
    // Ne jamais bloquer le flux principal si la notif échoue
    console.error("❌ Erreur création notification :", error.message);
    return null;
  }
}

// ── Récupérer les notifications d'un utilisateur ─────────
export async function getUserNotifications(userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where:   { userId },
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, total, unreadCount };
}

// ── Marquer toutes comme lues ─────────────────────────────
export async function markAllRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data:  { isRead: true },
  });
}

// ── Supprimer une notification ────────────────────────────
export async function deleteNotification(notifId, userId) {
  await prisma.notification.deleteMany({
    where: { id: notifId, userId },
  });
}