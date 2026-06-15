// guards roles + KYC //
// ============================================================
// LAUNCHPAD — middleware/authorize.js
// Guards de rôle et KYC
// Usage :
//   requireRole("admin")          → admin seulement
//   requireRole("student","admin")→ student OU admin
//   requireKyc                    → kycValidated requis
// ============================================================

import { AppError } from "./errorHandler.js";

// ── Guard de rôle ─────────────────────────────────────────
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Non authentifié.", 401, "UNAUTHORIZED"));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          `Accès refusé. Rôle requis : ${roles.join(" ou ")}.`,
          403,
          "FORBIDDEN"
        )
      );
    }

    next();
  };
}

// ── Guard KYC ────────────────────────────────────────────
// Vérifie que l'utilisateur a son KYC validé
// Les admins passent toujours (ils n'ont pas de KYC)
export function requireKyc(req, res, next) {
  if (!req.user) {
    return next(new AppError("Non authentifié.", 401, "UNAUTHORIZED"));
  }

  // Les admins sont exemptés du KYC
  if (req.user.role === "admin") {
    return next();
  }

  if (!req.user.kycValidated) {
    return next(
      new AppError(
        "Votre compte doit être vérifié (KYC) avant cette action. " +
        "Rendez-vous dans la section Vérification de votre profil.",
        403,
        "KYC_REQUIRED"
      )
    );
  }

  next();
}

// ── Guard propriétaire (l'utilisateur ne peut modifier que ses données) ──
// Usage : requireOwner("userId") — vérifie req.params.userId === req.user.id
export function requireOwnerOrAdmin(paramName = "userId") {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Non authentifié.", 401, "UNAUTHORIZED"));
    }

    const resourceOwnerId = req.params[paramName];

    if (req.user.role === "admin" || req.user.id === resourceOwnerId) {
      return next();
    }

    return next(
      new AppError(
        "Vous ne pouvez pas modifier les données d'un autre utilisateur.",
        403,
        "FORBIDDEN"
      )
    );
  };
}