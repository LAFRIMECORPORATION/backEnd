// ============================================================
// LAUNCHPAD — Reports Service
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";

// ── Créer un signalement ────────────────────────────────────────
export async function createReport(reporterId, { entityType, entityId, reason, severity = "medium" }) {
  const report = await prisma.report.create({
    data: {
      reporterId,
      entityType,
      entityId,
      reason,
      severity,
      status: "pending",
    },
    include: {
      reporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return report;
}

// ── Obtenir les signalements de l'utilisateur ────────────────────
export async function getUserReports(userId) {
  const reports = await prisma.report.findMany({
    where: { reporterId: userId },
    orderBy: { createdAt: "desc" },
  });

  return reports;
}

// ── Lister tous les signalements (admin) ────────────────────────
export async function listReports({ page = 1, limit = 20, status, severity }) {
  const skip = (page - 1) * limit;

  const where = {
    ...(status && { status }),
    ...(severity && { severity }),
  };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return {
    reports,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Détail d'un signalement ────────────────────────────────────────
export async function getReportById(id) {
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      reporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!report) {
    throw new AppError("Signalement introuvable.", 404, "NOT_FOUND");
  }

  return report;
}

// ── Mettre à jour le statut d'un signalement ───────────────────────
export async function updateReportStatus(id, { status, notes }) {
  const report = await prisma.report.update({
    where: { id },
    data: {
      status,
      notes,
    },
    include: {
      reporter: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return report;
}
