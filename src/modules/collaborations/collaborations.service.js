// ============================================================
// LAUNCHPAD — collaborations/collaborations.service.js
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";
import { checkAndAwardBadges } from "../badges/badges.service.js";

export async function sendRequest(requesterId, { projectId, message }) {
  const project = await prisma.project.findFirst({
    where:  { id: projectId, status: "active" },
    select: { id: true, title: true, authorId: true },
  });
  if (!project) throw new AppError("Projet introuvable ou inactif.", 404, "NOT_FOUND");
  if (project.authorId === requesterId) throw new AppError("Vous ne pouvez pas collaborer avec votre propre projet.", 400, "SELF_REQUEST");

  // Vérifier doublon
  const existing = await prisma.collaboration.findFirst({
    where: { requesterId, projectId, status: "pending" },
  });
  if (existing) throw new AppError("Vous avez déjà une demande en attente pour ce projet.", 409, "DUPLICATE");

  const collab = await prisma.collaboration.create({
    data: { requesterId, projectId, message: message?.trim() || null, status: "pending" },
    select: _collabSelect(),
  });

  await createNotification({
    userId:    project.authorId,
    type:      "collaboration",
    title:     "🤝 Nouvelle demande de collaboration",
    body:      `${collab.requester.firstName} souhaite collaborer sur "${project.title}"`,
    actionUrl: `/collaboration`,
  });

  return collab;
}

export async function listInbox(userId) {
  const [received, sent] = await Promise.all([
    prisma.collaboration.findMany({
      where:   { project: { authorId: userId } },
      orderBy: { createdAt: "desc" },
      select:  _collabSelect(),
    }),
    prisma.collaboration.findMany({
      where:   { requesterId: userId },
      orderBy: { createdAt: "desc" },
      select:  _collabSelect(),
    }),
  ]);
  return { received, sent };
}

export async function getOne(collabId, userId) {
  const collab = await prisma.collaboration.findFirst({
    where: {
      id: collabId,
      OR: [{ requesterId: userId }, { project: { authorId: userId } }],
    },
    select: _collabSelect(),
  });
  if (!collab) throw new AppError("Demande introuvable.", 404, "NOT_FOUND");
  return collab;
}

export async function accept(collabId, userId) {
  const collab = await prisma.collaboration.findFirst({
    where:  { id: collabId, project: { authorId: userId }, status: "pending" },
    select: { id: true, requesterId: true, project: { select: { title: true } } },
  });
  if (!collab) throw new AppError("Demande introuvable ou non autorisée.", 404, "NOT_FOUND");

  const updated = await prisma.collaboration.update({
    where: { id: collabId },
    data:  { status: "accepted", respondedAt: new Date() },
    select: _collabSelect(),
  });

  await createNotification({
    userId:    collab.requesterId,
    type:      "collaboration",
    title:     "✅ Demande de collaboration acceptée !",
    body:      `Votre demande pour "${collab.project.title}" a été acceptée.`,
    actionUrl: `/collaboration`,
  });

  await checkAndAwardBadges(collab.requesterId, "collaboration_accepted");

  return updated;
}

export async function decline(collabId, userId, reason) {
  const collab = await prisma.collaboration.findFirst({
    where:  { id: collabId, project: { authorId: userId }, status: "pending" },
    select: { id: true, requesterId: true, project: { select: { title: true } } },
  });
  if (!collab) throw new AppError("Demande introuvable ou non autorisée.", 404, "NOT_FOUND");

  const updated = await prisma.collaboration.update({
    where: { id: collabId },
    data:  { status: "declined", reason: reason?.trim() || null, respondedAt: new Date() },
    select: _collabSelect(),
  });

  await createNotification({
    userId:    collab.requesterId,
    type:      "collaboration",
    title:     "❌ Demande de collaboration refusée",
    body:      `Votre demande pour "${collab.project.title}" n'a pas été retenue.`,
    actionUrl: `/collaboration`,
  });

  return updated;
}

function _collabSelect() {
  return {
    id:          true,
    status:      true,
    message:     true,
    reason:      true,
    createdAt:   true,
    respondedAt: true,
    requester: {
      select: {
        id: true, firstName: true, lastName: true,
        profile: { select: { avatarUrl: true } },
      },
    },
    project: {
      select: { id: true, title: true, category: true },
    },
  };
}