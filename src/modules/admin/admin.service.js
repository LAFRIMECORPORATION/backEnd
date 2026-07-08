// ============================================================
// LAUNCHPAD — admin/admin.service.js
// Dashboard admin : stats, modération, gestion utilisateurs
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";

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
    prisma.project.count(),
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
    },
    investments: {
      total:       totalInvestments,
      totalVolume: Number(totalVolume._sum.amount || 0),
      revenue30d:  Number(revenueStats._sum.platformFee || 0),
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
        profile: { select: { avatarUrl: true } },
        _count: {
          select: { projects: true, investments: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, totalPages: Math.ceil(total / limit) };
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

  return updated;
}

// ════════════════════════════════════════════════════════════
// LISTE DES PROJETS POUR MODÉRATION
// GET /api/admin/projects
// ════════════════════════════════════════════════════════════
export async function listProjectsAdmin({ status, page = 1, limit = 20 }) {
  const skip  = (page - 1) * limit;
  const where = status ? { status } : {};

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:           true,
        title:        true,
        category:     true,
        status:       true,
        goalAmount:   true,
        raisedAmount: true,
        createdAt:    true,
        author: {
          select: {
            id: true, firstName: true, lastName: true,
            kycValidated: true,
            profile: { select: { avatarUrl: true } },
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
    data:  { status: "active", approvedAt: new Date(), approvedBy: adminId },
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
    actionUrl: `/project/${projectId}`,
  });

  await prisma.feedEvent.create({
    data: {
      actorId:    project.authorId,
      eventType:  "project_published",
      entityType: "project",
      entityId:   projectId,
      projectId,
      metadata:   { title: project.title },
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

  return { rejected: true, projectId };
}

// ════════════════════════════════════════════════════════════
// LOGS D'AUDIT
// GET /api/admin/audit-logs
// ════════════════════════════════════════════════════════════
export async function getAuditLogs({ page = 1, limit = 50, action }) {
  const skip  = (page - 1) * limit;
  const where = action ? { action } : {};

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