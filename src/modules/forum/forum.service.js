// ============================================================
// LAUNCHPAD — forum/forum.service.js
// Logique métier : posts, réponses, likes, modération
// ============================================================

import prisma from "../../config/database.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";
import { awardBadge } from "../badges/badges.service.js";

// ── Catégories valides ────────────────────────────────────────
export const FORUM_CATEGORIES = [
  "general", "financement", "juridique", "tech",
  "marketing", "success-stories", "questions", "annonces",
];

// ── Initialisation des catégories par défaut ─────────────────────
export async function initializeCategories() {
  const categories = [
    { name: "general", description: "Discussions générales", icon: "chat" },
    { name: "financement", description: "Questions sur le financement", icon: "dollar" },
    { name: "juridique", description: "Conseils juridiques", icon: "scale" },
    { name: "tech", description: "Technologie et développement", icon: "code" },
    { name: "marketing", description: "Stratégies marketing", icon: "megaphone" },
    { name: "success-stories", description: "Histoires de succès", icon: "star" },
    { name: "questions", description: "Questions diverses", icon: "help" },
    { name: "annonces", description: "Annonces importantes", icon: "bell" },
  ];

  for (const cat of categories) {
    await prisma.forumCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
}

// ════════════════════════════════════════════════════════════
// CRÉER UN POST
// POST /api/forum/posts
// ════════════════════════════════════════════════════════════
export async function createPost(authorId, { title, content, category, tags = [] }) {
  if (!FORUM_CATEGORIES.includes(category)) {
    throw new AppError(`Catégorie invalide. Valeurs acceptées : ${FORUM_CATEGORIES.join(", ")}`, 400, "INVALID_CATEGORY");
  }

  // Trouver ou créer la catégorie par son nom
  let categoryRecord = await prisma.forumCategory.findUnique({
    where: { name: category },
    select: { id: true },
  });

  if (!categoryRecord) {
    // Créer la catégorie si elle n'existe pas
    const categoryData = {
      name: category,
      description: `Catégorie ${category}`,
      icon: "comment",
    };
    categoryRecord = await prisma.forumCategory.create({
      data: categoryData,
      select: { id: true },
    });
  }

  const post = await prisma.forumPost.create({
    data: {
      authorId,
      categoryId: categoryRecord.id,
      title:    title.trim(),
      content:  content.trim(),
    },
    select: _postSelect(authorId),
  });

  // Badge "Premier post" si c'est le 1er
  const postCount = await prisma.forumPost.count({ where: { authorId } });
  if (postCount === 1) {
    await awardBadge(authorId, "first_forum_post").catch(console.error);
  }

  // Feed event
  await prisma.feedEvent.create({
    data: {
      actorId:    authorId,
      eventType:  "forum_post",
      entityType: "forum_post",
      entityId:   post.id,
      metadata:   { title: post.title, category },
    },
  }).catch(console.error);

  return post;
}

// ════════════════════════════════════════════════════════════
// LISTER LES POSTS
// GET /api/forum/posts
// ════════════════════════════════════════════════════════════
export async function listPosts(userId, { category, search, sort = "recent", page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;

  const where = {
    isDeleted: false,
    ...(category && category !== "all" ? { category: { name: category } } : {}),
    ...(search ? {
      OR: [
        { title:   { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ],
    } : {}),
  };

  const orderBy = sort === "popular"
    ? [{ likesCount: "desc" }, { createdAt: "desc" }]
    : sort === "replies"
    ? [{ repliesCount: "desc" }, { createdAt: "desc" }]
    : [{ isPinned: "desc" }, { createdAt: "desc" }];

  const [posts, total] = await Promise.all([
    prisma.forumPost.findMany({
      where,
      skip,
      take:    limit,
      orderBy,
      select:  _postSelect(userId),
    }),
    prisma.forumPost.count({ where }),
  ]);

  return {
    posts,
    total,
    totalPages: Math.ceil(total / limit),
    page,
  };
}

// ════════════════════════════════════════════════════════════
// DÉTAIL D'UN POST + SES RÉPONSES
// GET /api/forum/posts/:id
// ════════════════════════════════════════════════════════════
export async function getPost(postId, userId) {
  const post = await prisma.forumPost.findFirst({
    where:  { id: postId, isDeleted: false },
    select: {
      ..._postSelect(userId),
      categoryId: true,
      replies: {
        where:   { isDeleted: false, parentId: postId },
        orderBy: { createdAt: "asc" },
        select:  _postSelect(userId),
      },
    },
  });

  if (!post) throw new AppError("Post introuvable.", 404, "NOT_FOUND");

  // Incrémenter le compteur de vues
  await prisma.forumPost.update({
    where: { id: postId },
    data:  { viewsCount: { increment: 1 } },
  }).catch(console.error);

  return post;
}

// ════════════════════════════════════════════════════════════
// MODIFIER UN POST
// PUT /api/forum/posts/:id
// ════════════════════════════════════════════════════════════
export async function updatePost(postId, userId, { title, content, tags }) {
  const post = await prisma.forumPost.findFirst({
    where: { id: postId, isDeleted: false },
    select: { authorId: true },
  });

  if (!post) throw new AppError("Post introuvable.", 404, "NOT_FOUND");
  if (post.authorId !== userId) throw new AppError("Non autorisé.", 403, "FORBIDDEN");

  return prisma.forumPost.update({
    where: { id: postId },
    data: {
      ...(title   ? { title:   title.trim()   } : {}),
      ...(content ? { content: content.trim() } : {}),
      ...(tags    ? { tags }                    : {}),
      isEdited: true,
    },
    select: _postSelect(userId),
  });
}

// ════════════════════════════════════════════════════════════
// SUPPRIMER UN POST (soft delete)
// DELETE /api/forum/posts/:id
// ════════════════════════════════════════════════════════════
export async function deletePost(postId, userId, userRole) {
  const post = await prisma.forumPost.findFirst({
    where:  { id: postId, isDeleted: false },
    select: { authorId: true },
  });

  if (!post) throw new AppError("Post introuvable.", 404, "NOT_FOUND");

  const canDelete = post.authorId === userId || userRole === "admin";
  if (!canDelete) throw new AppError("Non autorisé.", 403, "FORBIDDEN");

  await prisma.forumPost.update({
    where: { id: postId },
    data:  { isDeleted: true, deletedAt: new Date() },
  });

  return { deleted: true };
}

// ════════════════════════════════════════════════════════════
// LIKE / UNLIKE UN POST
// POST /api/forum/posts/:id/like
// ════════════════════════════════════════════════════════════
export async function togglePostLike(postId, userId) {
  const post = await prisma.forumPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, likesCount: true },
  });

  if (!post) throw new AppError("Post introuvable.", 404, "NOT_FOUND");

  const existing = await prisma.forumPostLike.findFirst({
    where: { userId, postId },
  });

  if (existing) {
    // Unlike
    await prisma.$transaction([
      prisma.forumPostLike.delete({ where: { id: existing.id } }),
      prisma.forumPost.update({
        where: { id: postId },
        data:  { likesCount: { decrement: 1 } },
      }),
    ]);
    return { liked: false, likesCount: post.likesCount - 1 };
  } else {
    // Like
    await prisma.$transaction([
      prisma.forumPostLike.create({ data: { userId, postId } }),
      prisma.forumPost.update({
        where: { id: postId },
        data:  { likesCount: { increment: 1 } },
      }),
    ]);
    // Notifier l'auteur (pas si c'est lui-même)
    if (post.authorId !== userId) {
      createNotification({
        userId:    post.authorId,
        type:      "forum",
        title:     "❤️ Quelqu'un a aimé votre post",
        body:      "Votre post dans le forum a reçu un like.",
        actionUrl: `/forum/${postId}`,
      }).catch(console.error);
    }

    return { liked: true, likesCount: post.likesCount + 1 };
  }
}

// ════════════════════════════════════════════════════════════
// AJOUTER UNE RÉPONSE
// POST /api/forum/posts/:id/replies
// ═══════════════════════════════════════════════════════════
export async function addReply(postId, authorId, { content, parentReplyId }) {
  // Retrieve the post (or parent reply) to get category and ensure it exists
  const parent = await prisma.forumPost.findFirst({
    where: { id: parentReplyId ? parentReplyId : postId, isDeleted: false },
    select: { id: true, authorId: true, title: true, categoryId: true },
  });

  if (!parent) throw new AppError("Post ou réponse introuvable.", 404, "NOT_FOUND");

  // Create the reply, linking to the author via authorId and preserving the category
  const reply = await prisma.forumPost.create({
    data: {
      authorId,
      categoryId: parent.categoryId,
      parentId: parent.id,
      content: content.trim(),
    },
    select: _postSelect(authorId),
  });

  // Recompute replies count for the original top‑level post
  const topPostId = parentReplyId ? postId : parent.id;
  const repliesCount = await prisma.forumPost.count({ where: { parentId: topPostId, isDeleted: false } });

  // Notify the author of the top‑level post if someone else replied
  if (parent.authorId !== authorId) {
    createNotification({
      userId:    parent.authorId,
      type:      "forum",
      title:     "💬 Nouvelle réponse à votre post",
      body:      `Quelqu'un a répondu à votre post "${parent.title.substring(0, 50)}"`,
      actionUrl: `/forum/${topPostId}`,
    }).catch(console.error);
  }

  return { ...reply, repliesCount };
}

// ════════════════════════════════════════════════════════════
// LIKER UNE RÉPONSE
// POST /api/forum/replies/:id/like
// ════════════════════════════════════════════════════════════
export async function toggleReplyLike(replyId, userId) {
  const reply = await prisma.forumPost.findFirst({
    where:  { id: replyId, isDeleted: false, parentId: { not: null } },
    select: { id: true, likesCount: true },
  });

  if (!reply) throw new AppError("Réponse introuvable.", 404, "NOT_FOUND");

  const existing = await prisma.forumPostLike.findFirst({
    where: { userId, postId: replyId },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.forumPostLike.delete({ where: { id: existing.id } }),
      prisma.forumPost.update({ where: { id: replyId }, data: { likesCount: { decrement: 1 } } }),
    ]);
    return { liked: false, likesCount: reply.likesCount - 1 };
  } else {
    await prisma.$transaction([
      prisma.forumPostLike.create({ data: { userId, postId: replyId } }),
      prisma.forumPost.update({ where: { id: replyId }, data: { likesCount: { increment: 1 } } }),
    ]);
    return { liked: true, likesCount: reply.likesCount + 1 };
  }
}

// ════════════════════════════════════════════════════════════
// [ADMIN] ÉPINGLER / DÉSÉPINGLER UN POST
// PUT /api/admin/forum/posts/:id/pin
// ════════════════════════════════════════════════════════════
export async function togglePin(postId) {
  const post = await prisma.forumPost.findFirst({
    where:  { id: postId, isDeleted: false },
    select: { isPinned: true },
  });

  if (!post) throw new AppError("Post introuvable.", 404, "NOT_FOUND");

  const updated = await prisma.forumPost.update({
    where: { id: postId },
    data:  { isPinned: !post.isPinned },
    select: { id: true, isPinned: true },
  });

  return updated;
}

// ── Sélecteurs réutilisables ─────────────────────────────────
function _postSelect(userId) {
  return {
    id:           true,
    title:        true,
    content:      true,
    category:     true,
    likesCount:   true,
    repliesCount: true,
    viewsCount:   true,
    isPinned:     true,
    isEdited:     true,
    createdAt:    true,
    author: {
      select: {
        id:        true,
        firstName: true,
        lastName:  true,
        avatarUrl: true,
      },
    },
    likes: userId
      ? { where: { userId }, select: { userId: true }, take: 1 }
      : false,
  };
}

// _replySelect supprimé - on utilise _postSelect pour les réponses aussi (auto-référence)