// generation de JWT pour l'authentification et la gestion des sessions //
// ============================================================
// LAUNCHPAD — utils/jwt.js
// Génération et vérification des tokens JWT
// ============================================================

import jwt from "jsonwebtoken";
import { env } from "../../../backEnd/src/config/env.js";
import prisma from "../../../backEnd/src/config/database.js";

// ── Générer un access token (15 min) ─────────────────────
export function generateAccessToken(user) {
  return jwt.sign(
    {
      userId:       user.id,
      role:         user.role,
      kycValidated: user.kycValidated,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

// ── Générer un refresh token (7 jours) ───────────────────
export function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
}

// ── Sauvegarder le refresh token en DB ───────────────────
export async function saveRefreshToken(userId, token) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });
}

// ── Vérifier et utiliser un refresh token ────────────────
export async function verifyRefreshToken(token) {
  // 1. Vérifier la signature JWT
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);

  // 2. Vérifier que le token existe en DB et n'est pas expiré
  const stored = await prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!stored) {
    throw new Error("Refresh token introuvable ou déjà utilisé.");
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token } });
    throw new Error("Refresh token expiré.");
  }

  // 3. Supprimer le token utilisé (rotation)
  await prisma.refreshToken.delete({ where: { token } });

  return decoded;
}

// ── Révoquer tous les tokens d'un utilisateur ────────────
// Utilisé lors du logout ou si le compte est compromis
export async function revokeAllTokens(userId) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

// ── Générer la paire complète de tokens ──────────────────
export async function generateTokenPair(user) {
  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await saveRefreshToken(user.id, refreshToken);
  return { accessToken, refreshToken };
}