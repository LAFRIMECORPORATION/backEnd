// ============================================================
// LAUNCHPAD — Push Subscriptions Service
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";

// ── S'abonner aux notifications push ─────────────────────────────
export async function subscribe(userId, { endpoint, p256dhKey, authKey, deviceInfo }) {
  const existing = await prisma.pushSubscription.findFirst({
    where: { userId, endpoint },
  });

  if (existing) {
    await prisma.pushSubscription.update({
      where: { id: existing.id },
      data: { p256dhKey, authKey, deviceInfo },
    });
    return existing;
  }

  const subscription = await prisma.pushSubscription.create({
    data: {
      userId,
      endpoint,
      p256dhKey,
      authKey,
      deviceInfo,
    },
  });

  return subscription;
}

// ── Se désabonner des notifications push ─────────────────────────
export async function unsubscribe(userId, endpoint) {
  const subscription = await prisma.pushSubscription.findFirst({
    where: { userId, endpoint },
  });

  if (!subscription) {
    throw new AppError("Abonnement introuvable.", 404, "NOT_FOUND");
  }

  await prisma.pushSubscription.delete({
    where: { id: subscription.id },
  });

  return { success: true };
}

// ── Obtenir les abonnements de l'utilisateur ───────────────────────
export async function getUserSubscriptions(userId) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return subscriptions;
}
