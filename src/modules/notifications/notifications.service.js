// ============================================================
// LAUNCHPAD — notifications/notifications.service.js
// Notifications in-app + Web Push (VAPID)
// ============================================================

import prisma  from "../../config/database.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errorHandler.js";

// ════════════════════════════════════════════════════════════
// CRÉER UNE NOTIFICATION
// Appelée en interne par tous les autres modules
// ════════════════════════════════════════════════════════════
export async function createNotification({ userId, type, title, body, actionUrl }) {
  const notif = await prisma.notification.create({
    data: { userId, type, title, body, actionUrl },
  });

  // Tenter un Web Push si l'utilisateur a une subscription
  sendWebPush(userId, { title, body, actionUrl }).catch(console.error);

  return notif;
}

// ════════════════════════════════════════════════════════════
// LISTER LES NOTIFICATIONS D'UN UTILISATEUR
// GET /api/notifications
// ════════════════════════════════════════════════════════════
export async function listNotifications(userId, { page = 1, limit = 30, unreadOnly = false }) {
  const skip  = (page - 1) * limit;
  const where = {
    userId,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        type:      true,
        title:     true,
        body:      true,
        actionUrl: true,
        isRead:    true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, total, unreadCount, page };
}

// ════════════════════════════════════════════════════════════
// MARQUER TOUTES COMME LUES
// PUT /api/notifications/mark-all-read
// ════════════════════════════════════════════════════════════
export async function markAllRead(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data:  { isRead: true, readAt: new Date() },
  });
  return { updated: result.count };
}

// ════════════════════════════════════════════════════════════
// MARQUER UNE NOTIFICATION COMME LUE
// PUT /api/notifications/:id/read
// ════════════════════════════════════════════════════════════
export async function markOneRead(notifId, userId) {
  const notif = await prisma.notification.findFirst({
    where: { id: notifId, userId },
  });
  if (!notif) throw new AppError("Notification introuvable.", 404, "NOT_FOUND");

  return prisma.notification.update({
    where: { id: notifId },
    data:  { isRead: true, readAt: new Date() },
  });
}

// ════════════════════════════════════════════════════════════
// SUPPRIMER UNE NOTIFICATION
// DELETE /api/notifications/:id
// ════════════════════════════════════════════════════════════
export async function deleteNotification(notifId, userId) {
  const notif = await prisma.notification.findFirst({
    where: { id: notifId, userId },
  });
  if (!notif) throw new AppError("Notification introuvable.", 404, "NOT_FOUND");

  await prisma.notification.delete({ where: { id: notifId } });
  return { deleted: true };
}

// ════════════════════════════════════════════════════════════
// S'ABONNER AUX WEB PUSH
// POST /api/notifications/push/subscribe
// ════════════════════════════════════════════════════════════
export async function subscribePush(userId, subscription) {
  // subscription = { endpoint, keys: { p256dh, auth } }
  await prisma.pushSubscription.upsert({
    where:  { endpoint: subscription.endpoint },
    update: { userId, keys: subscription.keys, updatedAt: new Date() },
    create: { userId, endpoint: subscription.endpoint, keys: subscription.keys },
  });
  return { subscribed: true };
}

// ════════════════════════════════════════════════════════════
// SE DÉSABONNER DES WEB PUSH
// DELETE /api/notifications/push/unsubscribe
// ════════════════════════════════════════════════════════════
export async function unsubscribePush(userId, endpoint) {
  await prisma.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });
  return { unsubscribed: true };
}

// ════════════════════════════════════════════════════════════
// ENVOYER UN WEB PUSH (interne)
// ════════════════════════════════════════════════════════════
async function sendWebPush(userId, { title, body, actionUrl }) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (!subscriptions.length) return;

  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails(
    `mailto:${env.SUPPORT_EMAIL || "support@launchpad.cm"}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );

  const payload = JSON.stringify({ title, body, actionUrl });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
    } catch (err) {
      // Si la subscription est expirée → la supprimer
      if (err.statusCode === 410 || err.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(console.error);
      }
    }
  }
}

// ════════════════════════════════════════════════════════════
// COMPTER LES NON-LUES (utilisé par la Navbar)
// GET /api/notifications/unread-count
// ════════════════════════════════════════════════════════════
export async function getUnreadCount(userId) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { unreadCount: count };
}