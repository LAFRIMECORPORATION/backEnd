// ============================================================
// LAUNCHPAD — users/users.service.js
// Gestion des profils utilisateurs
// ============================================================

import bcrypt from "bcryptjs";
import prisma from "../../config/database.js";
import { uploadAvatar } from "../../config/cloudinary.js";
import { AppError } from "../../middleware/errorHandler.js";

// ── Sélecteur profil public ───────────────────────────────
const PUBLIC_SELECT = {
  id:          true,
  firstName:   true,
  lastName:    true,
  role:        true,
  avatarUrl:   true,
  bio:         true,
  kycValidated:true,
  reputationScore: true,
  createdAt:   true,
  profile: {
    select: {
      university:       true,
      company:          true,
      location:         true,
      skills:           true,
      interests:        true,
      linkedinUrl:      true,
      githubUrl:        true,
      portfolioUrl:     true,
      availability:     true,
      investmentRegions:true,
    },
  },
  badges: {
    select: {
      id:        true,
      badgeType: true,
      badgeLabel:true,
      badgeIcon: true,
      pointsAwarded: true,
      awardedAt: true,
    },
    orderBy: { awardedAt: "desc" },
    take: 6,
  },
  _count: {
    select: {
      projects:    true,
      investments: true,
    },
  },
};

// ── GET /users/:id ────────────────────────────────────────
export async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where:  { id, isActive: true },
    select: PUBLIC_SELECT,
  });

  if (!user) {
    throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");
  }

  return user;
}

// ── PUT /users/:id ────────────────────────────────────────
export async function updateUser(userId, data, requesterId) {
  // Seul l'utilisateur lui-même ou un admin peut modifier
  const requester = await prisma.user.findUnique({
    where:  { id: requesterId },
    select: { role: true },
  });

  if (requesterId !== userId && requester?.role !== "admin") {
    throw new AppError("Accès refusé.", 403, "FORBIDDEN");
  }

  const { firstName, lastName, bio, profile } = data;

  // Mise à jour en transaction
  const updated = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data:  {
        ...(firstName && { firstName }),
        ...(lastName  && { lastName  }),
        ...(bio       !== undefined && { bio }),
      },
      select: { id: true, firstName: true, lastName: true, bio: true, avatarUrl: true },
    });

    if (profile) {
      await tx.userProfile.upsert({
        where:  { userId },
        create: { userId, ...profile },
        update: profile,
      });
    }

    return updatedUser;
  });

  return updated;
}

// ── POST /users/:id/avatar ────────────────────────────────
export async function updateAvatar(userId, fileBuffer) {
  return new Promise((resolve, reject) => {
    const stream = require("cloudinary").v2.uploader.upload_stream(
      {
        folder:    "launchpad/avatars",
        public_id: `avatar_${userId}`,
        overwrite: true,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      async (error, result) => {
        if (error) return reject(error);

        const updated = await prisma.user.update({
          where:  { id: userId },
          data:   { avatarUrl: result.secure_url },
          select: { id: true, avatarUrl: true },
        });

        resolve(updated);
      }
    );
    stream.end(fileBuffer);
  });
}

// ── GET /users (admin seulement) ─────────────────────────
export async function listUsers({ page = 1, limit = 20, role, search }) {
  const skip = (page - 1) * limit;

  const where = {
    isActive: true,
    ...(role   && { role }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName:  { contains: search, mode: "insensitive" } },
        { email:     { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select: {
        id:          true,
        email:       true,
        firstName:   true,
        lastName:    true,
        role:        true,
        avatarUrl:   true,
        kycValidated:true,
        kycStatus:   true,
        isActive:    true,
        createdAt:   true,
        _count: { select: { projects: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}