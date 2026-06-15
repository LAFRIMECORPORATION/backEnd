// verification JWT //
// ============================================================
// LAUNCHPAD — middleware/authenticate.js
// Vérifie le JWT sur chaque route protégée
// Injecte req.user = { id, role, kycValidated, ... }
// ============================================================

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errorHandler.js";
import prisma from "../config/database.js";

// ── Middleware principal ──────────────────────────────────
export async function authenticate(req, res, next) {
  try {
    // 1. Récupérer le token depuis le header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AppError("Token d'authentification manquant.", 401, "UNAUTHORIZED");
    }

    const token = authHeader.split(" ")[1];

    // 2. Vérifier et décoder le token
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // 3. Vérifier que l'utilisateur existe toujours et est actif
    const user = await prisma.user.findUnique({
      where:  { id: decoded.userId },
      select: {
        id:           true,
        email:        true,
        role:         true,
        firstName:    true,
        lastName:     true,
        avatarUrl:    true,
        kycValidated: true,
        kycStatus:    true,
        isActive:     true,
      },
    });

    if (!user) {
      throw new AppError("Utilisateur introuvable.", 401, "UNAUTHORIZED");
    }

    if (!user.isActive) {
      throw new AppError("Compte désactivé. Contactez le support.", 403, "ACCOUNT_DISABLED");
    }

    // 4. Injecter l'utilisateur dans la requête
    req.user = user;
    next();

  } catch (error) {
    next(error);
  }
}

// ── Middleware optionnel (ne bloque pas si pas de token) ──
// Utile pour les routes publiques qui ont un comportement
// différent selon qu'on est connecté ou non (ex: /projects)
export async function authenticateOptional(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where:  { id: decoded.userId },
      select: {
        id:           true,
        email:        true,
        role:         true,
        firstName:    true,
        lastName:     true,
        kycValidated: true,
        kycStatus:    true,
        isActive:     true,
      },
    });

    req.user = user?.isActive ? user : null;
    next();

  } catch {
    req.user = null;
    next();
  }
}