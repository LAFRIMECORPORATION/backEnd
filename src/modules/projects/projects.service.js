// ============================================================
// LAUNCHPAD — projects/projects.service.js
// Logique métier complète du module Projets
// ============================================================

import prisma from "../../config/database.js";
import { uploadProjectCover } from "../../config/cloudinary.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";
import { sendProjectPublishedEmail, sendAdminNewProjectEmail } from "../../utils/email.js";

// ── Sélecteur liste projets (léger) ──────────────────────
const PROJECT_LIST_SELECT = {
  id:             true,
  title:          true,
  tagline:        true,
  category:       true,
  stage:          true,
  goalAmount:     true,
  raisedAmount:   true,
  equityPct:      true,
  equityType:     true,
  deadline:       true,
  tags:           true,
  coverImageUrl:  true,
  status:         true,
  viewsCount:     true,
  likesCount:     true,
  sharesCount:    true,
  investorsCount: true,
  teamSize:       true,
  publishedAt:    true,
  createdAt:      true,
  author: {
    select: {
      id:           true,
      firstName:    true,
      lastName:     true,
      avatarUrl:    true,
      kycValidated: true,
      profile: { select: { university: true, location: true } },
    },
  },
  _count: {
    select: { likes: true, comments: true, investments: true },
  },
};

// ── Sélecteur détail projet (complet) ────────────────────
const PROJECT_DETAIL_SELECT = {
  ...PROJECT_LIST_SELECT,
  description:   true,
  problem:       true,
  solution:      true,
  businessModel: true,
  pitchDeckUrl:  true,
  demoVideoUrl:  true,
  githubUrl:     true,
  adminNote:     true,
  author: {
    select: {
      id:           true,
      firstName:    true,
      lastName:     true,
      avatarUrl:    true,
      bio:          true,
      kycValidated: true,
      reputationScore: true,
      profile: {
        select: {
          university:  true,
          location:    true,
          skills:      true,
          linkedinUrl: true,
          githubUrl:   true,
        },
      },
      badges: {
        select: { badgeIcon: true, badgeLabel: true },
        take: 3,
      },
    },
  },
  comments: {
    where: { isDeleted: false, parentId: null },
    orderBy: { createdAt: "desc" },
    select: {
      id:         true,
      content:    true,
      likesCount: true,
      createdAt:  true,
      author: {
        select: {
          id: true, firstName: true, lastName: true, avatarUrl: true,
        },
      },
      replies: {
        where:   { isDeleted: false },
        orderBy: { createdAt: "asc" },
        select: {
          id:         true,
          content:    true,
          parentId:   true,
          likesCount: true,
          createdAt:  true,
          author: {
            select: {
              id: true, firstName: true, lastName: true, avatarUrl: true,
            },
          },
        },
      },
    },
  },
};

// ════════════════════════════════════════════════════════════
// CRÉER UN PROJET (brouillon)
// ════════════════════════════════════════════════════════════
export async function createProject(authorId, data) {
  const project = await prisma.project.create({
    data: {
      authorId,
      title:         data.title,
      tagline:       data.tagline,
      category:      data.category,
      description:   data.description,
      problem:       data.problem       || null,
      solution:      data.solution      || null,
      businessModel: data.businessModel || null,
      stage:         data.stage,
      goalAmount:    data.goalAmount,
      equityPct:     data.equityPct     || null,
      equityType:    data.equityType    || "equity",
      deadline:      data.deadline      ? new Date(data.deadline) : null,
      tags:          data.tags          || [],
      githubUrl:     data.githubUrl     || null,
      demoVideoUrl:  data.demoVideoUrl  || null,
      teamSize:      data.teamSize      || 1,
      status:        "draft",
    },
    select: PROJECT_LIST_SELECT,
  });

  return project;
}

// ════════════════════════════════════════════════════════════
// UPLOADER L'IMAGE COVER
// ════════════════════════════════════════════════════════════
export async function uploadCover(projectId, authorId, fileBuffer) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, authorId },
    select: { id: true },
  });

  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  const result = await uploadProjectCover(fileBuffer, projectId);

  const updated = await prisma.project.update({
    where: { id: projectId },
    data:  { coverImageUrl: result.secure_url },
    select: { id: true, coverImageUrl: true },
  });

  return updated;
}

// ════════════════════════════════════════════════════════════
// PUBLIER UN PROJET (draft → pending)
// ════════════════════════════════════════════════════════════
export async function publishProject(projectId, authorId) {
  const project = await prisma.project.findFirst({
    where:  { id: projectId, authorId },
    select: {
      id: true, title: true, status: true,
      authorId: true,
      author: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  if (!["draft", "rejected"].includes(project.status)) {
    throw new AppError(
      "Seuls les projets en brouillon ou rejetés peuvent être soumis.",
      400,
      "INVALID_STATUS"
    );
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data:  {
      status:      "pending",
      publishedAt: new Date(),
    },
    select: PROJECT_LIST_SELECT,
  });

  const admins = await prisma.user.findMany({
    where:  { role: "admin", isActive: true },
    select: { id: true, email: true, firstName: true },
  });

  for (const admin of admins) {
    createNotification({
      userId:    admin.id,
      type:      "system",
      title:     "📦 Nouveau projet à valider",
      body:      `${project.author.firstName} a soumis "${project.title}" pour modération.`,
      actionUrl: "/admin",
    }).catch(console.error);

    sendAdminNewProjectEmail(admin, project).catch(console.error);
  }

  return updated;
}

// ════════════════════════════════════════════════════════════
// LISTER LES PROJETS
// ════════════════════════════════════════════════════════════
export async function listProjects({
  page = 1, limit = 12,
  category, stage, minGoal, maxGoal,
  search, sort = "recent",
  status = "active",
  authorId = null,
}) {
  const skip = (page - 1) * limit;

  // 🛡️ FIX : Cloisonnement strict des statuts pour éviter qu'un tiers lise les brouillons (draft) privés d'un auteur
  const where = {
    ...(authorId ? { authorId } : { status }),
    ...(category && { category:  { equals: category, mode: "insensitive" } }),
    ...(stage    && { stage }),
    ...(minGoal  && { goalAmount: { gte: parseFloat(minGoal) } }),
    ...(maxGoal  && { goalAmount: { lte: parseFloat(maxGoal) } }),
    ...(search   && {
      OR: [
        { title:       { contains: search, mode: "insensitive" } },
        { tagline:     { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { hasSome: [search] } },
      ],
    }),
  };

  const orderBy = {
    recent:   { createdAt:    "desc" },
    popular:  { viewsCount:   "desc" },
    funded:   { raisedAmount: "desc" },
    deadline: { deadline:     "asc"  },
  }[sort] || { createdAt: "desc" };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take:    limit,
      orderBy,
      select:  PROJECT_LIST_SELECT,
    }),
    prisma.project.count({ where }),
  ]);

  const enriched = projects.map((p) => ({
    ...p,
    fundingPct:   Math.round((Number(p.raisedAmount) / Number(p.goalAmount)) * 100) || 0,
    goalAmount:   Number(p.goalAmount),
    raisedAmount: Number(p.raisedAmount),
    commentsCount: p._count?.comments || 0,
  }));

  return { projects: enriched, total };
}

// ════════════════════════════════════════════════════════════
// DÉTAIL D'UN PROJET
// ════════════════════════════════════════════════════════════
export async function getProjectById(id, viewerId = null) {
  const project = await prisma.project.findUnique({
    where:  { id },
    select: PROJECT_DETAIL_SELECT,
  });

  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  if (viewerId && viewerId !== project.author.id) {
    logView(id, viewerId).catch(console.error);
  }

  let isLiked = false;
  let isSaved = false;

  if (viewerId) {
    const [like, save] = await Promise.all([
      prisma.projectLike.findUnique({
        where: { userId_projectId: { userId: viewerId, projectId: id } },
      }),
      prisma.projectSave.findUnique({
        where: { userId_projectId: { userId: viewerId, projectId: id } },
      }),
    ]);
    isLiked = !!like;
    isSaved = !!save;
  }

  return {
    ...project,
    goalAmount:    Number(project.goalAmount),
    raisedAmount:  Number(project.raisedAmount),
    fundingPct:    Math.round((Number(project.raisedAmount) / Number(project.goalAmount)) * 100) || 0,
    isLiked,
    isSaved,
    commentsCount: project._count?.comments || 0,
  };
}

async function logView(projectId, userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingView = await prisma.feedEvent.findFirst({
    where: {
      actorId:    userId,
      entityId:   projectId,
      entityType: "project_view",
      createdAt:  { gte: today },
    },
  });

  if (!existingView) {
    await prisma.$transaction([
      prisma.project.update({
        where: { id: projectId },
        data:  { viewsCount: { increment: 1 } },
      }),
      prisma.feedEvent.create({
        data: {
          actorId:    userId,
          eventType:  "project_view",
          entityType: "project",
          entityId:   projectId,
          projectId,
          categories: [],
          metadata:   {},
        },
      }),
    ]);
  }
}

// ════════════════════════════════════════════════════════════
// MODIFIER UN PROJET
// ════════════════════════════════════════════════════════════
export async function updateProject(projectId, authorId, data, userRole) {
  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { id: true, authorId: true, status: true },
  });

  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  if (project.authorId !== authorId && userRole !== "admin") {
    throw new AppError("Accès refusé.", 403, "FORBIDDEN");
  }

  if (["funded", "expired"].includes(project.status) && userRole !== "admin") {
    throw new AppError(
      "Ce projet ne peut plus être modifié dans son état actuel.",
      400,
      "INVALID_STATUS"
    );
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(data.title         !== undefined && { title:         data.title         }),
      ...(data.tagline       !== undefined && { tagline:       data.tagline       }),
      ...(data.category      !== undefined && { category:      data.category      }),
      ...(data.description   !== undefined && { description:   data.description   }),
      ...(data.problem       !== undefined && { problem:       data.problem       }),
      ...(data.solution      !== undefined && { solution:      data.solution      }),
      ...(data.businessModel !== undefined && { businessModel: data.businessModel }),
      ...(data.stage         !== undefined && { stage:         data.stage         }),
      ...(data.goalAmount    !== undefined && { goalAmount:    data.goalAmount    }),
      ...(data.equityPct     !== undefined && { equityPct:     data.equityPct     }),
      ...(data.equityType    !== undefined && { equityType:    data.equityType    }),
      ...(data.deadline      !== undefined && { deadline:      data.deadline ? new Date(data.deadline) : null }),
      ...(data.tags          !== undefined && { tags:          data.tags          }),
      ...(data.githubUrl     !== undefined && { githubUrl:     data.githubUrl     }),
      ...(data.demoVideoUrl  !== undefined && { demoVideoUrl:  data.demoVideoUrl  }),
      ...(data.teamSize      !== undefined && { teamSize:      data.teamSize      }),
    },
    select: PROJECT_LIST_SELECT,
  });

  return updated;
}

// ════════════════════════════════════════════════════════════
// SUPPRIMER UN PROJET
// ════════════════════════════════════════════════════════════
export async function deleteProject(projectId, requesterId, userRole) {
  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { id: true, authorId: true, status: true },
  });

  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  if (project.authorId !== requesterId && userRole !== "admin") {
    throw new AppError("Accès refusé.", 403, "FORBIDDEN");
  }

  if (project.status === "funded" && userRole !== "admin") {
    throw new AppError(
      "Un projet financé ne peut pas être supprimé.",
      400,
      "INVALID_STATUS"
    );
  }

  await prisma.project.delete({ where: { id: projectId } });

  return { message: "Projet supprimé." };
}

// ════════════════════════════════════════════════════════════
// LIKE / UNLIKE (Synchrone & Optimiste)
// ════════════════════════════════════════════════════════════
export async function toggleLike(projectId, userId) {
  const existing = await prisma.projectLike.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (existing) {
    const [, updatedProject] = await prisma.$transaction([
      prisma.projectLike.delete({
        where: { userId_projectId: { userId, projectId } },
      }),
      prisma.project.update({
        where: { id: projectId },
        data:  { likesCount: { decrement: 1 } },
        select: { likesCount: true }
      }),
    ]);
    
    return { 
      likedByMe: false, 
      likesCount: updatedProject.likesCount 
    };
  } else {
    const [, updatedProject] = await prisma.$transaction([
      prisma.projectLike.create({
        data: { userId, projectId },
      }),
      prisma.project.update({
        where: { id: projectId },
        data:  { likesCount: { increment: 1 } },
        select: { likesCount: true }
      }),
    ]);

    const project = await prisma.project.findUnique({
      where:  { id: projectId },
      select: {
        authorId: true, title: true,
        author: { select: { firstName: true } },
      },
    });
    
    const liker = await prisma.user.findUnique({
      where:  { id: userId },
      select: { firstName: true, lastName: true },
    });

    if (project && project.authorId !== userId) {
      createNotification({
        userId:    project.authorId,
        type:      "like",
        title:     "❤️ Nouveau like",
        body:      `${liker.firstName} ${liker.lastName} a aimé votre projet "${project.title}".`,
        actionUrl: `/project/${projectId}`,
      }).catch(console.error);
    }

    return { 
      likedByMe: true, 
      likesCount: updatedProject.likesCount 
    };
  }
}

// ════════════════════════════════════════════════════════════
// SAVE / UNSAVE
// ════════════════════════════════════════════════════════════
export async function toggleSave(projectId, userId) {
  const existing = await prisma.projectSave.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (existing) {
    await prisma.projectSave.delete({
      where: { userId_projectId: { userId, projectId } },
    });
    return { saved: false };
  } else {
    await prisma.projectSave.create({
      data: { userId, projectId },
    });
    return { saved: true };
  }
}

// ════════════════════════════════════════════════════════════
// COMMENTER
// ════════════════════════════════════════════════════════════
export async function addComment(projectId, authorId, { content, parentId }) {
  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { id: true, authorId: true, title: true },
  });
  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where:  { id: parentId },
      select: { id: true, projectId: true },
    });
    if (!parent || parent.projectId !== projectId) {
      throw new AppError("Commentaire parent introuvable.", 404, "NOT_FOUND");
    }
  }

  const comment = await prisma.comment.create({
    data: {
      projectId,
      authorId,
      content,
      parentId: parentId || null,
    },
    select: {
      id:       true,
      content:  true,
      parentId: true,
      createdAt:true,
      author: {
        select: {
          id:        true,
          firstName: true,
          lastName:  true,
          avatarUrl: true,
          role:      true,
        },
      },
    },
  });

  if (project.authorId !== authorId) {
    const commenter = await prisma.user.findUnique({
      where:  { id: authorId },
      select: { firstName: true, lastName: true },
    });
    createNotification({
      userId:    project.authorId,
      type:      "comment",
      title:     "💬 Nouveau commentaire",
      body:      `${commenter.firstName} a commenté votre projet "${project.title}".`,
      actionUrl: `/project/${projectId}`,
    }).catch(console.error);
  }

  return comment;
}

// ════════════════════════════════════════════════════════════
// LISTER LES COMMENTAIRES D'UN PROJET
// ════════════════════════════════════════════════════════════
export async function getComments(projectId, { page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;

  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where:   { projectId, parentId: null, isDeleted: false },
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:         true,
        content:    true,
        likesCount: true,
        createdAt:  true,
        author: {
          select: {
            id: true, firstName: true, lastName: true, avatarUrl: true,
          },
        },
        replies: {
          where:   { isDeleted: false },
          orderBy: { createdAt: "asc" },
          select: {
            id:         true,
            content:    true,
            parentId:   true, // 🛡️ FIX : Crucial pour l'arbre des réponses imbriquées côté React front-end
            likesCount: true,
            createdAt:  true,
            author: {
              select: {
                id: true, firstName: true, lastName: true, avatarUrl: true,
              },
            },
          },
        },
      },
    }),
    prisma.comment.count({ where: { projectId, parentId: null, isDeleted: false } }),
  ]);

  return { comments, total };
}

// ════════════════════════════════════════════════════════════
// LIKE / UNLIKE COMMENTAIRE
// ════════════════════════════════════════════════════════════
export async function toggleCommentLike(commentId, userId) {
  const existing = await prisma.commentLike.findUnique({
    where: { userId_commentId: { userId, commentId } },
  });

  if (existing) {
    const [, updatedComment] = await prisma.$transaction([
      prisma.commentLike.delete({
        where: { userId_commentId: { userId, commentId } },
      }),
      prisma.comment.update({
        where: { id: commentId },
        data:  { likesCount: { decrement: 1 } },
        select: { likesCount: true }
      }),
    ]);
    
    return { 
      likedByMe: false, 
      likesCount: updatedComment.likesCount 
    };
  } else {
    const [, updatedComment] = await prisma.$transaction([
      prisma.commentLike.create({
        data: { userId, commentId },
      }),
      prisma.comment.update({
        where: { id: commentId },
        data:  { likesCount: { increment: 1 } },
        select: { likesCount: true }
      }),
    ]);

    const comment = await prisma.comment.findUnique({
      where:  { id: commentId },
      select: {
        id: true,
        content: true,
        author: { select: { id: true, firstName: true } },
        project: { select: { id: true, title: true, authorId: true } },
      },
    });
    
    const liker = await prisma.user.findUnique({
      where:  { id: userId },
      select: { firstName: true, lastName: true },
    });

    if (comment && comment.project?.authorId !== userId) {
      createNotification({
        userId:    comment.project.authorId,
        type:      "comment_like",
        title:     "❤️ Like sur votre commentaire",
        body:      `${liker.firstName} ${liker.lastName} a aimé votre commentaire sur "${comment.project.title}".`,
        actionUrl: `/project/${comment.project.id}`,
      }).catch(console.error);
    }

    return { 
      likedByMe: true, 
      likesCount: updatedComment.likesCount 
    };
  }
}

// ════════════════════════════════════════════════════════════
// PROJETS SIMILAIRES
// ════════════════════════════════════════════════════════════
export async function getSimilarProjects(projectId) {
  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { category: true, tags: true, stage: true },
  });

  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  const similar = await prisma.project.findMany({
    where: {
      id:       { not: projectId },
      status:   "active",
      OR: [
        { category: project.category },
        { tags: { hasSome: project.tags } },
      ],
    },
    take:    4,
    orderBy: { viewsCount: "desc" },
    select:  PROJECT_LIST_SELECT,
  });

  return similar.map(p => ({
    ...p,
    goalAmount:   Number(p.goalAmount),
    raisedAmount: Number(p.raisedAmount),
    fundingPct:   Math.round((Number(p.raisedAmount) / Number(p.goalAmount)) * 100) || 0,
    similarityScore: project.category === p.category ? 75 : 60,
  }));
}

// ════════════════════════════════════════════════════════════
// [ADMIN] VALIDER UN PROJET
// ════════════════════════════════════════════════════════════
export async function approveProject(projectId, adminId, { note, featured } = {}) {
  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: {
      id: true, title: true, status: true,
      author: {
        select: { id: true, firstName: true, email: true },
      },
    },
  });

  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  if (project.status !== "pending") {
    throw new AppError("Seuls les projets en attente peuvent être approuvés.", 400, "INVALID_STATUS");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.project.update({
      where: { id: projectId },
      data: {
        status:    "active",
        adminNote: note || null,
      },
      select: PROJECT_LIST_SELECT,
    });

    await tx.feedEvent.create({
      data: {
        actorId:    project.author.id,
        eventType:  "project_published",
        entityType: "project",
        entityId:   projectId,
        projectId,
        categories: [p.category],
        metadata:   { title: p.title, stage: p.stage },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId:    adminId,
        action:     "PROJECT_APPROVED",
        entityType: "project",
        entityId:   projectId,
        newValues:  { status: "active", note },
      },
    });

    return p;
  });

  createNotification({
    userId:    project.author.id,
    type:      "system",
    title:     "✅ Projet publié !",
    body:      `Votre projet "${project.title}" a été validé et est maintenant visible sur Launchpad.`,
    actionUrl: `/project/${projectId}`,
  }).catch(console.error);

  await prisma.user.update({
    where: { id: project.author.id },
    data:  { reputationScore: { increment: 10 } },
  });

  const projectCount = await prisma.project.count({
    where: { authorId: project.author.id, status: "active" },
  });

  if (projectCount === 1) {
    // 🛡️ FIX : Appel correct de la fonction asynchrone déclarée ci-dessous
    await awardBadge(project.author.id, {
      badgeType:    "first_project",
      badgeLabel:   "Premier projet",
      badgeIcon:    "🌱",
      pointsAwarded: 10,
    });
  }

  return updated;
}

// ════════════════════════════════════════════════════════════
// [ADMIN] REJETER UN PROJET
// ════════════════════════════════════════════════════════════
export async function rejectProject(projectId, adminId, reason) {
  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: {
      id: true, title: true, status: true,
      author: { select: { id: true, firstName: true, email: true } },
    },
  });

  if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");

  if (project.status !== "pending") {
    throw new AppError("Seuls les projets en attente peuvent être rejetés.", 400, "INVALID_STATUS");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.project.update({
      where: { id: projectId },
      data: {
        status:    "rejected",
        adminNote: reason,
      },
      select: PROJECT_LIST_SELECT,
    });

    await tx.auditLog.create({
      data: {
        actorId:    adminId,
        action:     "PROJECT_REJECTED",
        entityType: "project",
        entityId:   projectId,
        newValues:  { status: "rejected", reason },
      },
    });

    return p;
  });

  createNotification({
    userId:    project.author.id,
    type:      "system",
    title:     "❌ Projet refusé",
    body:      `Votre projet "${project.title}" n'a pas pu être publié. Consultez les détails.`,
    actionUrl: `/project/${projectId}`,
  }).catch(console.error);

  return updated;
}

// ════════════════════════════════════════════════════════════
// [ADMIN] LISTER LES PROJETS EN ATTENTE
// ════════════════════════════════════════════════════════════
export async function listPendingProjects({ page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where:   { status: "pending" },
      skip,
      take:    limit,
      orderBy: { publishedAt: "asc" },
      select:  PROJECT_DETAIL_SELECT,
    }),
    prisma.project.count({ where: { status: "pending" } }),
  ]);

  return {
    projects: projects.map(p => ({
      ...p,
      goalAmount:   Number(p.goalAmount),
      raisedAmount: Number(p.raisedAmount),
      fundingPct:   Math.round((Number(p.raisedAmount) / Number(p.goalAmount)) * 100) || 0,
      commentsCount: p._count?.comments || 0,
    })),
    total,
  };
}

// ════════════════════════════════════════════════════════════
// RECALCULER LES STATS D'UN PROJET
// ════════════════════════════════════════════════════════════
export async function recalculateProjectStats(projectId) {
  const result = await prisma.investment.aggregate({
    where: { projectId, status: { in: ["in_escrow", "released"] } },
    _sum:  { amount: true },
    _count: { _all: true },
  });

  const investorsDistinct = await prisma.investment.findMany({
    where:   { projectId, status: { in: ["in_escrow", "released"] } },
    select:  { investorId: true },
    distinct:["investorId"],
  });

  const raisedAmount  = Number(result._sum.amount || 0);
  const investorsCount = investorsDistinct.length;

  const project = await prisma.project.findUnique({
    where:  { id: projectId },
    select: { goalAmount: true, status: true, authorId: true, title: true },
  });

  if (!project) return;

  const goalAmount = Number(project.goalAmount);
  const isFunded   = raisedAmount >= goalAmount;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      raisedAmount,
      investorsCount,
      ...(isFunded && project.status === "active" ? { status: "funded" } : {}),
    },
  });

  if (isFunded && project.status === "active") {
    await prisma.feedEvent.create({
      data: {
        actorId:    project.authorId,
        eventType:  "project_funded",
        entityType: "project",
        entityId:   projectId,
        projectId,
        metadata:   { title: project.title, raisedAmount },
      },
    });

    createNotification({
      userId:    project.authorId,
      type:      "investment",
      title:     "🎉 Projet financé à 100% !",
      body:      `Félicitations ! "${project.title}" a atteint son objectif de financement.`,
      actionUrl: `/project/${projectId}`,
    }).catch(console.error);
  }

  return { raisedAmount, investorsCount, isFunded };
}

// ════════════════════════════════════════════════════════════
// HELPER : Attribuer un badge (Déclaration Synchrone Propre)
// ════════════════════════════════════════════════════════════
export async function awardBadge(userId, { badgeType, badgeLabel, badgeIcon, pointsAwarded }) {
  try {
    const existing = await prisma.userBadge.findFirst({
      where: { userId, badgeType },
    });
    if (existing) return;

    await prisma.$transaction([
      prisma.userBadge.create({
        data: { userId, badgeType, badgeLabel, badgeIcon, pointsAwarded, awardedBy: "system" },
      }),
      prisma.user.update({
        where: { id: userId },
        data:  { reputationScore: { increment: pointsAwarded } },
      }),
    ]);

    createNotification({
      userId,
      type:      "badge",
      title:     `${badgeIcon} Nouveau badge obtenu !`,
      body:      `Vous avez obtenu le badge "${badgeLabel}" (+${pointsAwarded} pts).`,
      actionUrl: "/badges",
    }).catch(console.error);

  } catch (error) {
    console.error("❌ Erreur attribution badge :", error.message);
  }
}