// ============================================================
// LAUNCHPAD — admin/admin.service.js
// Dashboard admin : stats, modération, gestion utilisateurs
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";
import { randomUUID } from "node:crypto";

// ════════════════════════════════════════════════════════════
// STATISTIQUES GLOBALES
// GET /api/admin/statistics
// ════════════════════════════════════════════════════════════
export async function getStatistics() {
  const now     = new Date();
  const day30   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const day7    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    newUsers30d,
    totalProjects,
    activeProjects,
    pendingProjects,
    totalInvestments,
    totalVolume,
    pendingKyc,
    totalMessages,
    totalForumPosts,
    revenueStats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: day30 } } }),
    prisma.project.count({ where: { status: { in: ["active", "funded"] } } }),
    prisma.project.count({ where: { status: "active" } }),
    prisma.project.count({ where: { status: "pending" } }),
    prisma.investment.count({ where: { status: { in: ["in_escrow", "released"] } } }),
    prisma.investment.aggregate({
      where: { status: { in: ["in_escrow", "released"] } },
      _sum:  { amount: true },
    }),
    prisma.user.count({ where: { kycStatus: "submitted", kycValidated: false } }),
    prisma.message.count(),
    prisma.forumPost.count({ where: { isDeleted: false } }),
    prisma.investment.aggregate({
      where: { status: { in: ["in_escrow", "released"] }, createdAt: { gte: day30 } },
      _sum:  { platformFee: true },
    }),
  ]);

  // Répartition par rôle
  const usersByRole = await prisma.user.groupBy({
    by:     ["role"],
    _count: { id: true },
  });

  // Répartition projets par catégorie
  const projectsByCategory = await prisma.project.groupBy({
    by:     ["category"],
    where:  { status: { in: ["active", "funded"] } },
    _count: { id: true },
    orderBy:{ _count: { id: "desc" } },
  });

  const [projectsByStatus, kycByStatus, investmentsByStatus] = await Promise.all([
    prisma.project.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.user.groupBy({
      by: ["kycStatus"],
      _count: { id: true },
    }),
    prisma.investment.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  // Croissance utilisateurs sur 7 derniers jours
  const growthData = await prisma.$queryRaw`
    SELECT DATE("created_at")::text as date, COUNT(*)::int as count
    FROM users
    WHERE "created_at" >= ${day7}
    GROUP BY DATE("created_at")
    ORDER BY date ASC
  `.catch(() => []);

  return {
    users: {
      total:       totalUsers,
      new30d:      newUsers30d,
      byRole:      usersByRole.map(r => ({ role: r.role, count: r._count.id })),
      pendingKyc,
      growthData,
    },
    projects: {
      total:      totalProjects,
      active:     activeProjects,
      pending:    pendingProjects,
      byCategory: projectsByCategory.map(c => ({ category: c.category, count: c._count.id })),
      byStatus:   projectsByStatus.map(s => ({ status: s.status, count: s._count.id })),
    },
    investments: {
      total:       totalInvestments,
      totalVolume: Number(totalVolume._sum.amount || 0),
      revenue30d:  Number(revenueStats._sum.platformFee || 0),
      byStatus:    investmentsByStatus.map(s => ({ status: s.status, count: s._count.id })),
    },
    kyc: {
      byStatus: kycByStatus.map(s => ({ status: s.kycStatus, count: s._count.id })),
    },
    community: {
      totalMessages,
      totalForumPosts,
    },
  };
}

// ════════════════════════════════════════════════════════════
// LISTE DES UTILISATEURS
// GET /api/admin/users
// ════════════════════════════════════════════════════════════
export async function listUsers({ search, role, kycStatus, page = 1, limit = 20 }) {
  const skip  = (page - 1) * limit;

  const where = {
    ...(role      ? { role }      : {}),
    ...(kycStatus ? { kycStatus } : {}),
    ...(search ? {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName:  { contains: search, mode: "insensitive" } },
        { email:     { contains: search, mode: "insensitive" } },
      ],
    } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:             true,
        email:          true,
        firstName:      true,
        lastName:       true,
        role:           true,
        kycStatus:      true,
        kycValidated:   true,
        reputationScore:true,
        isActive:       true,
        createdAt:      true,
        avatarUrl:      true,
        _count: {
          select: { projects: true, investments: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

    // Add count of approved projects per user (status active or funded)
  const usersWithApprovedCount = await Promise.all(
    users.map(async (user) => ({
      ...user,
      approvedProjectsCount: await prisma.project.count({
        where: { authorId: user.id, status: { in: ["active", "funded"] } },
      }),
    }))
  );

  return {
    users: usersWithApprovedCount,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ════════════════════════════════════════════════════════════
// SUSPENDRE / RÉACTIVER UN UTILISATEUR
// PUT /api/admin/users/:id/toggle-status
// ════════════════════════════════════════════════════════════
export async function toggleUserStatus(userId, adminId, reason) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, isActive: true, email: true, role: true },
  });

  if (!user) throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");
  if (user.role === "admin") throw new AppError("Impossible de suspendre un admin.", 403, "FORBIDDEN");

  const updated = await prisma.user.update({
    where: { id: userId },
    data:  { isActive: !user.isActive },
    select: { id: true, isActive: true, email: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId:    adminId,
      action:     updated.isActive ? "USER_REACTIVATED" : "USER_SUSPENDED",
      entityType: "user",
      entityId:   userId,
      newValues:  { isActive: updated.isActive, reason },
    },
  });

  await createNotification({
    userId,
    type: "system",
    title: updated.isActive ? "✅ Compte réactivé" : "⚠️ Compte suspendu",
    body: updated.isActive
      ? "Votre compte Launchpad a été réactivé par l'administration."
      : `Votre compte Launchpad a été suspendu par l'administration.${reason ? ` Motif : ${reason}` : ""}`,
    actionUrl: "/",
  });

  return updated;
}

// ════════════════════════════════════════════════════════════
// SUPPRIMER UN UTILISATEUR (anonymisation irréversible)
// Les données liées aux investissements et à l'audit sont conservées
// pour l'intégrité comptable, mais les données personnelles sont effacées.
// ════════════════════════════════════════════════════════════
export async function deleteUser(userId, adminId, reason) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (!user) throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");
  if (user.role === "admin") {
    throw new AppError("La suppression d'un compte administrateur est interdite.", 403, "FORBIDDEN");
  }

  const deletedEmail = `deleted-${randomUUID()}@launchpad.invalid`;

  await prisma.$transaction(async (tx) => {
    await tx.kycDocument.deleteMany({ where: { userId } });
    await tx.kycFormData.deleteMany({ where: { userId } });
    await tx.userProfile.deleteMany({ where: { userId } });
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.pushSubscription.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: deletedEmail,
        passwordHash: `deleted-${randomUUID()}`,
        firstName: "Utilisateur",
        lastName: "supprime",
        avatarUrl: null,
        bio: null,
        isActive: false,
        isVerified: false,
        kycValidated: false,
        kycStatus: "rejected",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "USER_DELETED",
        entityType: "user",
        entityId: userId,
        oldValues: { email: user.email, role: user.role, isActive: user.isActive },
        newValues: { anonymized: true, reason: reason || null },
      },
    });
  });

  return { deleted: true, userId, anonymized: true };
}

// ════════════════════════════════════════════════════════════
// LISTE DES PROJETS POUR MODÉRATION
// GET /api/admin/projects
// ════════════════════════════════════════════════════════════
export async function listProjectsAdmin({ status, page = 1, limit = 20 }) {
  const skip  = (page - 1) * limit;
  const where = status && status !== "all" ? { status } : {};

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:           true,
        title:        true,
        description:  true,
        category:     true,
        stage:        true,
        status:       true,
        goalAmount:   true,
        raisedAmount: true,
        equityPct:    true,
        deadline:     true,
        coverImageUrl:true,
        pitchDeckUrl: true,
        demoVideoUrl: true,
        githubUrl:    true,
        createdAt:    true,
        author: {
          select: {
            id: true, firstName: true, lastName: true, email: true,
            kycValidated: true,
            avatarUrl: true,
          },
        },
        _count: { select: { investments: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return { projects, total, page, totalPages: Math.ceil(total / limit) };
}

// ════════════════════════════════════════════════════════════
// APPROUVER UN PROJET
// PUT /api/admin/projects/:id/approve
// ════════════════════════════════════════════════════════════
export async function approveProject(projectId, adminId, notes) {
  const project = await prisma.project.findFirst({
    where:  { id: projectId, status: "pending" },
    select: { id: true, title: true, authorId: true },
  });

  if (!project) throw new AppError("Projet introuvable ou déjà traité.", 404, "NOT_FOUND");

  await prisma.project.update({
    where: { id: projectId },
    data:  { status: "active", approvedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId:    adminId,
      action:     "PROJECT_APPROVED",
      entityType: "project",
      entityId:   projectId,
      newValues:  { status: "active", notes },
    },
  });

  await createNotification({
    userId:    project.authorId,
    type:      "system",
    title:     "🎉 Votre projet est en ligne !",
    body:      `"${project.title}" a été validé et est maintenant visible par les investisseurs.`,
    actionUrl: `/projects/${projectId}`,
  });

  await prisma.feedEvent.create({
    data: {
      actorId:    adminId,
      eventType:  "project_approved",
      entityType: "project",
      entityId:   projectId,
      projectId,
      metadata:   { title: project.title, ownerId: project.authorId },
    },
  }).catch(console.error);

  return { approved: true, projectId };
}

// ════════════════════════════════════════════════════════════
// REJETER UN PROJET
// PUT /api/admin/projects/:id/reject
// ════════════════════════════════════════════════════════════
export async function rejectProject(projectId, adminId, reason) {
  const project = await prisma.project.findFirst({
    where:  { id: projectId, status: "pending" },
    select: { id: true, title: true, authorId: true },
  });

  if (!project) throw new AppError("Projet introuvable ou déjà traité.", 404, "NOT_FOUND");

  await prisma.project.update({
    where: { id: projectId },
    data:  { status: "rejected", rejectedAt: new Date(), rejectionReason: reason },
  });

  await prisma.auditLog.create({
    data: {
      actorId:    adminId,
      action:     "PROJECT_REJECTED",
      entityType: "project",
      entityId:   projectId,
      newValues:  { status: "rejected", reason },
    },
  });

  await createNotification({
    userId:    project.authorId,
    type:      "system",
    title:     "❌ Projet non validé",
    body:      `"${project.title}" n'a pas été validé. Raison : ${reason}`,
    actionUrl: `/publish`,
  });

  await prisma.feedEvent.create({
    data: {
      actorId: adminId,
      eventType: "project_rejected",
      entityType: "project",
      entityId: projectId,
      projectId,
      metadata: { title: project.title, ownerId: project.authorId, reason },
    },
  }).catch(console.error);

  return { rejected: true, projectId };
}

// ════════════════════════════════════════════════════════════
// RETIRER UN PROJET (soft delete administratif)
// ════════════════════════════════════════════════════════════
export async function deleteProject(projectId, adminId, reason) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, status: true, authorId: true },
  });

  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        status: "rejected",
        rejectedAt: new Date(),
        rejectionReason: reason || "Projet retiré par un administrateur.",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "PROJECT_DELETED",
        entityType: "project",
        entityId: projectId,
        oldValues: { status: project.status },
        newValues: { status: "rejected", reason: reason || null },
      },
    });
  });

  await createNotification({
    userId: project.authorId,
    type: "system",
    title: "⚠️ Votre projet a été retiré",
    body: `Votre projet « ${project.title} » n'est plus affiché comme publié. Motif : ${reason || "Retrait administratif."}`,
    actionUrl: "/dashboard/student",
  });

  await prisma.feedEvent.create({
    data: {
      actorId: adminId,
      eventType: "project_removed",
      entityType: "project",
      entityId: projectId,
      projectId,
      metadata: { title: project.title, ownerId: project.authorId, reason },
    },
  }).catch(console.error);

  return { deleted: true, projectId, softDeleted: true };
}

// ════════════════════════════════════════════════════════════
// LOGS D'AUDIT
// GET /api/admin/audit-logs
// ════════════════════════════════════════════════════════════
export async function getAuditLogs({ page = 1, limit = 50, action, adminId, startDate, endDate }) {
  const skip  = (page - 1) * limit;
  const where = {
    ...(action ? { action } : {}),
    ...(adminId ? { actorId: adminId } : {}),
    ...((startDate || endDate) ? {
      createdAt: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      },
    } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:         true,
        action:     true,
        entityType: true,
        entityId:   true,
        newValues:  true,
        createdAt:  true,
        actor: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page };
}

export async function getMarketplaceOverview() {
  const [offers, applications, byOfferStatus, byApplicationStatus] = await Promise.all([
    prisma.investorRequest.findMany({
      where: { status: { not: "deleted" } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, title: true, description: true, reqType: true,
        status: true, createdAt: true, duration: true, budget: true,
        author: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { applications: true } },
        applications: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true, status: true, coverMessage: true, createdAt: true,
            applicant: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    }),
    prisma.requestApplication.count(),
    prisma.investorRequest.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.requestApplication.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  return {
    offers,
    applicationsTotal: applications,
    offersByStatus: byOfferStatus.map(item => ({ status: item.status, count: item._count.id })),
    applicationsByStatus: byApplicationStatus.map(item => ({ status: item.status, count: item._count.id })),
  };
}

export async function updateMarketplaceApplication(applicationId, adminId, status) {
  const allowedStatuses = ["pending", "accepted", "rejected"];
  if (!allowedStatuses.includes(status)) {
    throw new AppError("Statut de candidature invalide.", 400, "INVALID_STATUS");
  }

  const application = await prisma.requestApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, requestId: true, applicantId: true },
  });
  if (!application) throw new AppError("Candidature introuvable.", 404, "NOT_FOUND");

  const updated = await prisma.requestApplication.update({
    where: { id: applicationId },
    data: { status },
    select: { id: true, status: true, requestId: true, applicantId: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "MARKETPLACE_APPLICATION_STATUS_UPDATED",
      entityType: "request_application",
      entityId: applicationId,
      oldValues: { status: application.status },
      newValues: { status, requestId: application.requestId },
    },
  });

  await createNotification({
    userId: updated.applicantId,
    type: "investment",
    title: status === "accepted" ? "✅ Candidature acceptée" : status === "rejected" ? "Candidature refusée" : "Candidature en attente",
    body: `Le statut de votre candidature marketplace a été mis à jour : ${status}.`,
    actionUrl: "/investor-requests",
  });

  return updated;
}

export async function deleteMarketplaceOffer(offerId, adminId, reason) {
  const offer = await prisma.investorRequest.findUnique({
    where: { id: offerId },
    select: { id: true, title: true, status: true, authorId: true },
  });
  if (!offer) throw new AppError("Offre introuvable.", 404, "NOT_FOUND");

  await prisma.$transaction(async tx => {
    await tx.investorRequest.update({ where: { id: offerId }, data: { status: "deleted" } });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "MARKETPLACE_OFFER_DELETED",
        entityType: "investor_request",
        entityId: offerId,
        oldValues: { status: offer.status, title: offer.title },
        newValues: { status: "deleted", reason: reason || null },
      },
    });
  });

  await createNotification({
    userId: offer.authorId,
    type: "system",
    title: "⚠️ Votre offre marketplace a été supprimée",
    body: `L'offre « ${offer.title} » a été supprimée par l'administration.${reason ? ` Motif : ${reason}` : ""}`,
    actionUrl: "/investor-requests",
  });

  return { deleted: true, offerId };
}