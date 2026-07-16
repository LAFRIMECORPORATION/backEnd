// ============================================================
// LAUNCHPAD — badges/badges.service.js
// Attribution automatique de badges + points de réputation
// ============================================================

import prisma from "../../config/database.js";
import { createNotification } from "../notifications/notifications.service.js";

// ── Définition de tous les badges ────────────────────────────
export const BADGE_DEFINITIONS = {
  // Profil
  kyc_verified:      { label: "✅ Profil vérifié",      points: 20, icon: "✅" },
  profile_complete:  { label: "🌟 Profil complet",      points: 10, icon: "🌟" },

  // Projets
  first_project:     { label: "🌱 Premier projet",      points: 15, icon: "🌱" },
  funded_project:    { label: "🏆 Projet financé",      points: 50, icon: "🏆" },
  trending_project:  { label: "🔥 Projet Trending",     points: 25, icon: "🔥" },

  // Investissements
  first_investment:  { label: "💰 Premier investissement", points: 20, icon: "💰" },
  big_investor:      { label: "🦁 Grand investisseur",     points: 40, icon: "🦁" },

  // Communauté
  first_forum_post:  { label: "💬 Première contribution", points: 10, icon: "💬" },
  helpful_member:    { label: "🤝 Membre actif",           points: 15, icon: "🤝" },
  collaborator:      { label: "🤝 Collaborateur",          points: 20, icon: "🤝" },

  // Engagement
  early_adopter:     { label: "🚀 Early Adopter",          points: 30, icon: "🚀" },
};

// ════════════════════════════════════════════════════════════
// ATTRIBUER UN BADGE (si pas déjà obtenu)
// ════════════════════════════════════════════════════════════
export async function awardBadge(userId, badgeKey) {
  const definition = BADGE_DEFINITIONS[badgeKey];
  if (!definition) return null;

  // Vérifier si déjà obtenu
  const existing = await prisma.userBadge.findFirst({
    where: { userId, badgeType: badgeKey },
  });
  if (existing) return null;

  // Attribuer le badge + points
  const [badge] = await prisma.$transaction([
    prisma.userBadge.create({
      data: {
        userId,
        badgeType:  badgeKey,
        badgeLabel: definition.label,
        badgeIcon:  definition.icon,
        pointsAwarded: definition.points,
        awardedBy: "system",
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data:  { reputationScore: { increment: definition.points } },
    }),
  ]);

  // Notifier l'utilisateur
  createNotification({
    userId,
    type:      "badge",
    title:     `${definition.icon} Nouveau badge obtenu !`,
    body:      `Vous avez obtenu le badge "${definition.label}" (+${definition.points} pts)`,
    actionUrl: "/badges",
  }).catch(console.error);

  return badge;
}

// ════════════════════════════════════════════════════════════
// RÉCUPÉRER LES BADGES D'UN UTILISATEUR
// GET /api/badges/user/:id
// ════════════════════════════════════════════════════════════
export async function getUserBadges(userId) {
  const [badges, user] = await Promise.all([
    prisma.userBadge.findMany({
      where:   { userId },
      orderBy: { awardedAt: "desc" },
      select: {
        id:           true,
        badgeType:    true,
        badgeLabel:   true,
        badgeIcon:    true,
        pointsAwarded: true,
        awardedAt:    true,
      },
    }),
    prisma.user.findUnique({
      where:  { id: userId },
      select: { reputationScore: true },
    }),
  ]);

  // Ajouter les badges non encore obtenus (pour afficher les "locked")
  const earnedKeys  = badges.map(b => b.badgeType);
  const lockedBadges = Object.entries(BADGE_DEFINITIONS)
    .filter(([key]) => !earnedKeys.includes(key))
    .map(([key, def]) => ({
      badgeType:  key,
      badgeLabel: def.label,
      badgeIcon:  def.icon,
      points:     def.points,
      locked:     true,
    }));

  return {
    badges,
    lockedBadges,
    reputationScore: user?.reputationScore || 0,
    totalPoints:     badges.reduce((sum, b) => sum + b.pointsAwarded, 0),
  };
}

// ════════════════════════════════════════════════════════════
// VÉRIFIER ET ATTRIBUER LES BADGES AUTOMATIQUEMENT
// Appelée après chaque action significative
// ════════════════════════════════════════════════════════════
export async function checkAndAwardBadges(userId, trigger, context = {}) {
  const awarded = [];

  switch (trigger) {
    case "kyc_approved":
      awarded.push(await awardBadge(userId, "kyc_verified"));
      break;

    case "project_published": {
      const count = await prisma.project.count({ where: { authorId: userId, status: { not: "draft" } } });
      if (count === 1) awarded.push(await awardBadge(userId, "first_project"));
      break;
    }

    case "project_funded":
      awarded.push(await awardBadge(userId, "funded_project"));
      break;

    case "investment_confirmed": {
      const count = await prisma.investment.count({ where: { investorId: userId, status: "in_escrow" } });
      if (count === 1) awarded.push(await awardBadge(userId, "first_investment"));
      if (count >= 5) awarded.push(await awardBadge(userId, "big_investor"));
      break;
    }

    case "collaboration_accepted":
      awarded.push(await awardBadge(userId, "collaborator"));
      break;

    case "forum_post":
      // Géré directement dans forum.service.js
      break;

    case "forum_replies_10": {
      const count = await prisma.forumPost.count({ where: { authorId: userId, parentId: { not: null } } });
      if (count >= 10) awarded.push(await awardBadge(userId, "helpful_member"));
      break;
    }
  }

  return awarded.filter(Boolean);
}