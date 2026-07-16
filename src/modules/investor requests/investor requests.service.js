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

  const budgetJson = JSON.stringify({
    minAmount: minAmount || null,
    maxAmount: maxAmount || null,
    equityRange: equityRange || null,
    requirements: requirements?.trim() || null,
    deadline: deadline || null,
  });

  const request = await prisma.investorRequest.create({
    data: {
      authorId:     investorId,
      title:        title.trim(),
      description:  description.trim(),
      reqType:      type,
      skillsRequired: sectors || [],
      budget:       budgetJson,
      duration:     deadline || null,
      status:       "active",
    },
    select: _requestSelect(),
  });

  // Feed event
  await prisma.feedEvent.create({
    data: {
      actorId:    investorId,
      eventType:  "marketplace_posted",
      entityType: "investor_request",
      entityId:   request.id,
      metadata:   { title: request.title, type, sectors },
    },
  }).catch(console.error);

  return _mapRequest(request);
}

// ════════════════════════════════════════════════════════════
// LISTER LES OFFRES
// GET /api/investor-requests
// ════════════════════════════════════════════════════════════
export async function listRequests({ type, sector, search, page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;
  const nowIso = new Date().toISOString();

  const where = {
    status: "active",
    ...(type   ? { reqType: type }                                                   : {}),
    ...(sector ? { skillsRequired: { has: sector } }                               : {}),
    ...(search ? { OR: [
      { title:       { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ]} : {}),
    // Pas encore expirées (duration est le champ stockant la date limite brute)
    OR: [
      { duration: null },
      { duration: { gte: nowIso } }
    ],
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

  return { 
    requests: requests.map(_mapRequest), 
    total, 
    page, 
    totalPages: Math.ceil(total / limit) 
  };
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
          id:           true,
          status:       true,
          coverMessage: true,
          createdAt:    true,
          applicant: {
            select: {
              id: true, firstName: true, lastName: true, avatarUrl: true,
              profile: { select: { university: true } },
            },
          },
        },
      },
    },
  });

  if (!request) throw new AppError("Offre introuvable.", 404, "NOT_FOUND");
  return _mapRequest(request);
}

// ════════════════════════════════════════════════════════════
// POSTULER À UNE OFFRE (étudiant)
// POST /api/investor-requests/:id/apply
// ════════════════════════════════════════════════════════════
export async function applyToRequest(requestId, applicantId, { message, projectId }) {
  const request = await prisma.investorRequest.findFirst({
    where:  { id: requestId, status: "active" },
    select: { id: true, title: true, authorId: true },
  });

  if (!request) throw new AppError("Offre introuvable ou fermée.", 404, "NOT_FOUND");
  if (request.authorId === applicantId) {
    throw new AppError("Vous ne pouvez pas postuler à votre propre offre.", 400, "SELF_APPLY");
  }

  // Vérifier doublon
  const existing = await prisma.requestApplication.findUnique({
    where: { 
      requestId_applicantId: { requestId, applicantId }
    },
  });
  if (existing) throw new AppError("Vous avez déjà postulé à cette offre.", 409, "DUPLICATE");

  const application = await prisma.requestApplication.create({
    data: {
      requestId,
      applicantId,
      coverMessage: projectId ? `[Projet: ${projectId}] ${message?.trim() || ""}` : message?.trim() || null,
      status:    "pending",
    },
    select: {
      id: true, status: true, coverMessage: true, createdAt: true,
      applicant: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });

  // Notifier l'investisseur
  await createNotification({
    userId:    request.authorId,
    type:      "investment",
    title:     "📩 Nouvelle candidature reçue",
    body:      `${application.applicant.firstName} a postulé à votre offre "${request.title}"`,
    actionUrl: `/investor-requests/${requestId}`,
  });

  return _mapApplication(application);
}

// ════════════════════════════════════════════════════════════
// MODIFIER UNE OFFRE
// PUT /api/investor-requests/:id
// ════════════════════════════════════════════════════════════
export async function updateRequest(requestId, investorId, data) {
  const request = await prisma.investorRequest.findFirst({
    where:  { id: requestId, authorId: investorId },
    select: { id: true, budget: true, duration: true },
  });
  if (!request) throw new AppError("Offre introuvable ou non autorisée.", 404, "NOT_FOUND");

  let extra = {};
  if (request.budget) {
    try {
      extra = JSON.parse(request.budget);
    } catch (e) {}
  }

  if (data.minAmount !== undefined) extra.minAmount = data.minAmount;
  if (data.maxAmount !== undefined) extra.maxAmount = data.maxAmount;
  if (data.equityRange !== undefined) extra.equityRange = data.equityRange;
  if (data.requirements !== undefined) extra.requirements = data.requirements;
  if (data.deadline !== undefined) extra.deadline = data.deadline;

  const updated = await prisma.investorRequest.update({
    where: { id: requestId },
    data: {
      ...(data.title       ? { title:       data.title.trim()       } : {}),
      ...(data.description ? { description: data.description.trim() } : {}),
      ...(data.status      ? { status:      data.status             } : {}),
      ...(data.deadline    ? { duration:    data.deadline           } : {}),
      budget: JSON.stringify(extra),
    },
    select: _requestSelect(),
  });

  return _mapRequest(updated);
}

// ════════════════════════════════════════════════════════════
// SUPPRIMER UNE OFFRE
// DELETE /api/investor-requests/:id
// ════════════════════════════════════════════════════════════
export async function deleteRequest(requestId, investorId) {
  const request = await prisma.investorRequest.findFirst({
    where:  { id: requestId, authorId: investorId },
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
  const requests = await prisma.investorRequest.findMany({
    where:   { authorId: investorId, status: { not: "deleted" } },
    orderBy: { createdAt: "desc" },
    select:  {
      ..._requestSelect(),
      _count: { select: { applications: true } },
    },
  });

  return requests.map(_mapRequest);
}

// ── Sélecteur réutilisable ────────────────────────────────────
function _requestSelect() {
  return {
    id:             true,
    title:          true,
    description:    true,
    reqType:        true,
    skillsRequired: true,
    budget:         true,
    duration:       true,
    status:         true,
    createdAt:      true,
    author: {
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true,
        profile: { select: { company: true } },
      },
    },
  };
}

// ── Mappeurs internes pour assurer la compatibilité frontend ──
function _mapRequest(req) {
  if (!req) return null;
  let extra = {};
  if (req.budget) {
    try {
      extra = JSON.parse(req.budget);
    } catch (e) {}
  }

  return {
    id:           req.id,
    title:        req.title,
    description:  req.description,
    type:         req.reqType,
    sectors:      req.skillsRequired || [],
    minAmount:    extra.minAmount || null,
    maxAmount:    extra.maxAmount || null,
    equityRange:  extra.equityRange || null,
    requirements: extra.requirements || null,
    deadline:     extra.deadline || req.duration || null,
    status:       req.status,
    createdAt:    req.createdAt,
    investor:     req.author,
    _count:       req._count,
    applications: req.applications ? req.applications.map(_mapApplication) : undefined,
  };
}

function _mapApplication(app) {
  if (!app) return null;
  return {
    id:           app.id,
    status:       app.status,
    message:      app.coverMessage,
    createdAt:    app.createdAt,
    applicant:    app.applicant,
    project:      null, // Projet simulé car non existant dans le nouveau schéma
  };
}