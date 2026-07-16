// ============================================================
// LAUNCHPAD — collaborations/collaborations.service.js
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";
import { checkAndAwardBadges } from "../badges/badges.service.js";

export async function sendRequest(requesterId, { projectFromId, projectToId, collabType, message, skillsOffered }) {
  // Vérifier que les deux projets existent
  const [projectFrom, projectTo] = await Promise.all([
    prisma.project.findFirst({
      where:  { id: projectFromId, status: "active" },
      select: { id: true, title: true, authorId: true },
    }),
    prisma.project.findFirst({
      where:  { id: projectToId, status: "active" },
      select: { id: true, title: true, authorId: true },
    }),
  ]);
  
  if (!projectFrom) throw new AppError("Projet source introuvable ou inactif.", 404, "NOT_FOUND");
  if (!projectTo) throw new AppError("Projet cible introuvable ou inactif.", 404, "NOT_FOUND");
  if (projectFrom.authorId !== requesterId) throw new AppError("Vous devez être l'auteur du projet source.", 403, "FORBIDDEN");
  if (projectFromId === projectToId) throw new AppError("Vous ne pouvez pas collaborer avec votre propre projet.", 400, "SELF_REQUEST");

  // Vérifier doublon
  const existing = await prisma.collaboration.findFirst({
    where: { requesterId, projectFromId, projectToId, status: "pending" },
  });
  if (existing) throw new AppError("Vous avez déjà une demande en attente entre ces projets.", 409, "DUPLICATE");

  const collab = await prisma.collaboration.create({
    data: { 
      requesterId, 
      projectFromId, 
      projectToId, 
      collabType: collabType || "general",
      message: message?.trim() || "", 
      skillsOffered: skillsOffered || [],
      status: "pending" 
    },
    select: _collabSelect(),
  });

  await createNotification({
    userId:    projectTo.authorId,
    type:      "collaboration",
    title:     "🤝 Nouvelle demande de collaboration",
    body:      `${collab.requester.firstName} souhaite collaborer sur "${projectTo.title}"`,
    actionUrl: `/collaborations?request=${collab.id}`,
  });

  return collab;
}

export async function listInbox(userId) {
  const [received, sent] = await Promise.all([
    prisma.collaboration.findMany({
      where:   { projectTo: { authorId: userId } },
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
      OR: [{ requesterId: userId }, { projectTo: { authorId: userId } }],
    },
    select: _collabSelect(),
  });
  if (!collab) throw new AppError("Demande introuvable.", 404, "NOT_FOUND");
  return collab;
}

export async function accept(collabId, userId) {
  const collab = await prisma.collaboration.findFirst({
    where:  { id: collabId, projectTo: { authorId: userId }, status: "pending" },
    select: { id: true, requesterId: true, projectTo: { select: { title: true } } },
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
    body:      `Votre demande pour "${collab.projectTo.title}" a été acceptée.`,
    actionUrl: `/collaborations?request=${collab.id}`,
  });

  await checkAndAwardBadges(collab.requesterId, "collaboration_accepted");

  return updated;
}

export async function decline(collabId, userId, reason) {
  const collab = await prisma.collaboration.findFirst({
    where:  { id: collabId, projectTo: { authorId: userId }, status: "pending" },
    select: { id: true, requesterId: true, projectTo: { select: { title: true } } },
  });
  if (!collab) throw new AppError("Demande introuvable ou non autorisée.", 404, "NOT_FOUND");

  const updated = await prisma.collaboration.update({
    where: { id: collabId },
    data:  { status: "rejected", reason: reason?.trim() || null, respondedAt: new Date() },
    select: _collabSelect(),
  });

  await createNotification({
    userId:    collab.requesterId,
    type:      "collaboration",
    title:     "❌ Demande de collaboration refusée",
    body:      `Votre demande pour "${collab.projectTo.title}" n'a pas été retenue.`,
    actionUrl: `/collaborations?request=${collab.id}`,
  });

  return updated;
}

function _collabSelect() {
  return {
    id:            true,
    status:        true,
    collabType:    true,
    message:       true,
    reason:        true,
    skillsOffered: true,
    similarityScore: true,
    respondedAt:   true,
    createdAt:     true,
    updatedAt:     true,
    requester: {
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true,
      },
    },
    projectFrom: {
      select: { id: true, title: true, category: true },
    },
    projectTo: {
      select: { id: true, title: true, category: true },
    },
  };
}