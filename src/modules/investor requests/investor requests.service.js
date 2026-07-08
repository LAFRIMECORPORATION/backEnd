// ============================================================
// LAUNCHPAD — investor-requests/investor-requests.service.js
// Marketplace : investisseurs publient des offres, étudiants postulent
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";

export const REQUEST_TYPES = ["equity", "loan", "grant", "mentoring"];

// ════════════════════════════════════════════════════════════
// PUBLIER UNE OFFRE (investisseur)
// POST /api/investor-requests
// ════════════════════════════════════════════════════════════
export async function createRequest(investorId, {
  title, description, type, sectors, minAmount, maxAmount,
  equityRange, requirements, deadline,
}) {
  if (!REQUEST_TYPES.includes(type)) {
    throw new AppError(`Type invalide. Valeurs : ${REQUEST_TYPES.join(", ")}`, 400, "INVALID_TYPE");
  }

  const request = await prisma.investorRequest.create({
    data: {
      investorId,
      title:        title.trim(),
      description:  description.trim(),
      type,
      sectors:      sectors || [],
      minAmount:    minAmount || null,
      maxAmount:    maxAmount || null,
      equityRange:  equityRange || null,
      requirements: requirements?.trim() || null,
      deadline:     deadline ? new Date(deadline) : null,
      status:       "active",
    },
    select: _requestSelect(),
  });

  // Feed event
  await prisma.feedEvent.create({
    data: {
      actorId:    investorId,
      eventType:  "investor_request_published",
      entityType: "investor_request",
      entityId:   request.id,
      metadata:   { title: request.title, type, sectors },
    },
  }).catch(console.error);

  return request;
}

// ════════════════════════════════════════════════════════════
// LISTER LES OFFRES
// GET /api/investor-requests
// ════════════════════════════════════════════════════════════
export async function listRequests({ type, sector, search, page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;

  const where = {
    status: "active",
    ...(type   ? { type }                                                   : {}),
    ...(sector ? { sectors: { has: sector } }                               : {}),
    ...(search ? { OR: [
      { title:       { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ]} : {}),
    // Pas encore expirées
    OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
  };

  const [requests, total] = await Promise.all([
    prisma.investorRequest.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select:  _requestSelect(),
    }),
    prisma.investorRequest.count({ where }),
  ]);

  return { requests, total, page, totalPages: Math.ceil(total / limit) };
}

// ════════════════════════════════════════════════════════════
// DÉTAIL D'UNE OFFRE
// GET /api/investor-requests/:id
// ════════════════════════════════════════════════════════════
export async function getRequest(requestId) {
  const request = await prisma.investorRequest.findFirst({
    where:  { id: requestId, status: { not: "deleted" } },
    select: {
      ..._requestSelect(),
      applications: {
        select: {
          id:        true,
          status:    true,
          message:   true,
          createdAt: true,
          applicant: {
            select: {
              id: true, firstName: true, lastName: true,
              profile: { select: { avatarUrl: true, university: true } },
            },
          },
          project: { select: { id: true, title: true, category: true } },
        },
      },
    },
  });

  if (!request) throw new AppError("Offre introuvable.", 404, "NOT_FOUND");
  return request;
}

// ════════════════════════════════════════════════════════════
// POSTULER À UNE OFFRE (étudiant)
// POST /api/investor-requests/:id/apply
// ════════════════════════════════════════════════════════════
export async function applyToRequest(requestId, applicantId, { message, projectId }) {
  const request = await prisma.investorRequest.findFirst({
    where:  { id: requestId, status: "active" },
    select: { id: true, title: true, investorId: true },
  });

  if (!request) throw new AppError("Offre introuvable ou fermée.", 404, "NOT_FOUND");
  if (request.investorId === applicantId) {
    throw new AppError("Vous ne pouvez pas postuler à votre propre offre.", 400, "SELF_APPLY");
  }

  // Vérifier doublon
  const existing = await prisma.investorRequestApplication.findFirst({
    where: { requestId, applicantId },
  });
  if (existing) throw new AppError("Vous avez déjà postulé à cette offre.", 409, "DUPLICATE");

  const application = await prisma.investorRequestApplication.create({
    data: {
      requestId,
      applicantId,
      projectId: projectId || null,
      message:   message?.trim() || null,
      status:    "pending",
    },
    select: {
      id: true, status: true, message: true, createdAt: true,
      applicant: { select: { id: true, firstName: true, lastName: true } },
      project:   { select: { id: true, title: true } },
    },
  });

  // Notifier l'investisseur
  await createNotification({
    userId:    request.investorId,
    type:      "investment",
    title:     "📩 Nouvelle candidature reçue",
    body:      `${application.applicant.firstName} a postulé à votre offre "${request.title}"`,
    actionUrl: `/investor-requests/${requestId}`,
  });

  return application;
}

// ════════════════════════════════════════════════════════════
// MODIFIER UNE OFFRE
// PUT /api/investor-requests/:id
// ════════════════════════════════════════════════════════════
export async function updateRequest(requestId, investorId, data) {
  const request = await prisma.investorRequest.findFirst({
    where:  { id: requestId, investorId },
    select: { id: true },
  });
  if (!request) throw new AppError("Offre introuvable ou non autorisée.", 404, "NOT_FOUND");

  return prisma.investorRequest.update({
    where: { id: requestId },
    data: {
      ...(data.title       ? { title:       data.title.trim()       } : {}),
      ...(data.description ? { description: data.description.trim() } : {}),
      ...(data.status      ? { status:      data.status             } : {}),
      ...(data.deadline    ? { deadline:    new Date(data.deadline)  } : {}),
    },
    select: _requestSelect(),
  });
}

// ════════════════════════════════════════════════════════════
// SUPPRIMER UNE OFFRE
// DELETE /api/investor-requests/:id
// ════════════════════════════════════════════════════════════
export async function deleteRequest(requestId, investorId) {
  const request = await prisma.investorRequest.findFirst({
    where:  { id: requestId, investorId },
    select: { id: true },
  });
  if (!request) throw new AppError("Offre introuvable ou non autorisée.", 404, "NOT_FOUND");

  await prisma.investorRequest.update({
    where: { id: requestId },
    data:  { status: "deleted" },
  });

  return { deleted: true };
}

// ════════════════════════════════════════════════════════════
// MES OFFRES (investisseur)
// GET /api/investor-requests/mine
// ════════════════════════════════════════════════════════════
export async function myRequests(investorId) {
  return prisma.investorRequest.findMany({
    where:   { investorId, status: { not: "deleted" } },
    orderBy: { createdAt: "desc" },
    select:  {
      ..._requestSelect(),
      _count: { select: { applications: true } },
    },
  });
}

// ── Sélecteur réutilisable ────────────────────────────────────
function _requestSelect() {
  return {
    id:           true,
    title:        true,
    description:  true,
    type:         true,
    sectors:      true,
    minAmount:    true,
    maxAmount:    true,
    equityRange:  true,
    requirements: true,
    deadline:     true,
    status:       true,
    createdAt:    true,
    investor: {
      select: {
        id: true, firstName: true, lastName: true,
        profile: { select: { avatarUrl: true, company: true } },
      },
    },
  };
}