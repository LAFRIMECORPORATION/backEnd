// ============================================================
// LAUNCHPAD — auth/auth.service.js
// Logique métier de l'authentification
// ============================================================

import bcrypt from "bcryptjs";
import prisma from "../../config/database.js";
import { generateTokenPair, verifyRefreshToken, revokeAllTokens } from "../../utils/jwt.js";
import { sendWelcomeEmail } from "../../utils/email.js";
import { AppError } from "../../middleware/errorHandler.js";

// ── Sélecteur commun des données utilisateur ─────────────
// Ce que l'on retourne au frontend après connexion
const USER_SELECT = {
  id:           true,
  email:        true,
  role:         true,
  firstName:    true,
  lastName:     true,
  avatarUrl:    true,
  kycValidated: true,
  kycStatus:    true,
  reputationScore: true,
  createdAt:    true,
  profile: {
    select: {
      university: true,
      company:    true,
      location:   true,
      skills:     true,
      interests:  true,
    },
  },
};

// ── REGISTER ─────────────────────────────────────────────
export async function register({ email, password, firstName, lastName, role }) {
  // 1. Vérifier que l'email n'est pas déjà utilisé
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Cet email est déjà utilisé.", 409, "EMAIL_ALREADY_EXISTS");
  }

  // 2. Les admins ne peuvent pas s'inscrire via l'API publique
  if (role === "admin") {
    throw new AppError("Inscription impossible avec ce rôle.", 403, "FORBIDDEN");
  }

  // 3. Hasher le mot de passe
  const passwordHash = await bcrypt.hash(password, 12);

  // 4. Créer l'utilisateur + son profil en transaction
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role,
      },
      select: USER_SELECT,
    });

    // Créer le profil vide associé
    await tx.userProfile.create({
      data: { userId: newUser.id },
    });

    return newUser;
  });

  // 5. Générer les tokens
  const tokens = await generateTokenPair(user);

  // 6. Envoyer l'email de bienvenue (asynchrone, ne bloque pas)
  sendWelcomeEmail(user).catch(console.error);

  return { user, ...tokens };
}

// ── LOGIN ────────────────────────────────────────────────
export async function login({ email, password }) {
  // 1. Trouver l'utilisateur
  const user = await prisma.user.findUnique({
    where:  { email },
    select: {
      ...USER_SELECT,
      passwordHash: true,  // On a besoin du hash pour comparer
      isActive:     true,
    },
  });

  // Message générique pour ne pas révéler si l'email existe
  if (!user) {
    throw new AppError("Email ou mot de passe incorrect.", 401, "INVALID_CREDENTIALS");
  }

  // 2. Vérifier que le compte est actif
  if (!user.isActive) {
    throw new AppError("Compte désactivé. Contactez le support.", 403, "ACCOUNT_DISABLED");
  }

  // 3. Vérifier le mot de passe
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError("Email ou mot de passe incorrect.", 401, "INVALID_CREDENTIALS");
  }

  // 4. Retirer le hash du mot de passe avant de retourner
  const { passwordHash: _, isActive: __, ...safeUser } = user;

  // 5. Générer les tokens
  const tokens = await generateTokenPair(safeUser);

  return { user: safeUser, ...tokens };
}

// ── REFRESH TOKEN ────────────────────────────────────────
export async function refreshAccessToken(token) {
  // 1. Vérifier et consommer le refresh token
  const decoded = await verifyRefreshToken(token);

  // 2. Récupérer l'utilisateur à jour (son KYC peut avoir changé)
  const user = await prisma.user.findUnique({
    where:  { id: decoded.userId },
    select: USER_SELECT,
  });

  if (!user) {
    throw new AppError("Utilisateur introuvable.", 401, "UNAUTHORIZED");
  }

  // 3. Générer une nouvelle paire de tokens (rotation)
  const tokens = await generateTokenPair(user);

  return { user, ...tokens };
}

// ── LOGOUT ───────────────────────────────────────────────
export async function logout(userId) {
  // Révoquer tous les refresh tokens de l'utilisateur
  await revokeAllTokens(userId);
}

// ── GET CURRENT USER ─────────────────────────────────────
export async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: USER_SELECT,
  });

  if (!user) {
    throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");
  }

  return user;
}