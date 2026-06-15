// erreurd uniformes //
// ============================================================
// LAUNCHPAD — middleware/errorHandler.js
// Handler d'erreurs global — format JSON uniforme
// ============================================================

import { env } from "../config/env.js";

// ── Classe d'erreur personnalisée ────────────────────────
export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code       = code;
    this.isOperational = true;
  }
}

// ── Erreurs courantes prédéfinies ────────────────────────
export const Errors = {
  // Auth
  UNAUTHORIZED:    new AppError("Non authentifié. Veuillez vous connecter.", 401, "UNAUTHORIZED"),
  FORBIDDEN:       new AppError("Accès refusé. Droits insuffisants.", 403, "FORBIDDEN"),
  INVALID_TOKEN:   new AppError("Token invalide ou expiré.", 401, "INVALID_TOKEN"),

  // KYC
  KYC_REQUIRED:    new AppError("Votre compte doit être vérifié (KYC) avant cette action.", 403, "KYC_REQUIRED"),

  // Ressources
  NOT_FOUND:       (resource = "Ressource") =>
    new AppError(`${resource} introuvable.`, 404, "NOT_FOUND"),
  ALREADY_EXISTS:  (resource = "Ressource") =>
    new AppError(`${resource} existe déjà.`, 409, "ALREADY_EXISTS"),

  // Validation
  VALIDATION:      (message) =>
    new AppError(message, 400, "VALIDATION_ERROR"),
};

// ── Handler global Express ───────────────────────────────
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let code       = err.code || "INTERNAL_ERROR";
  let message    = err.message || "Une erreur interne est survenue.";

  // Erreurs Prisma
  if (err.code === "P2002") {
    statusCode = 409;
    code = "ALREADY_EXISTS";
    const field = err.meta?.target?.[0] || "champ";
    message = `La valeur du ${field} est déjà utilisée.`;
  }

  if (err.code === "P2025") {
    statusCode = 404;
    code = "NOT_FOUND";
    message = "Enregistrement introuvable.";
  }

  // Erreurs JWT
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    code = "INVALID_TOKEN";
    message = "Token invalide.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    code = "TOKEN_EXPIRED";
    message = "Token expiré. Veuillez vous reconnecter.";
  }

  // Log en développement
  if (!env.IS_PROD && statusCode >= 500) {
    console.error("💥 Erreur serveur :", err);
  }

  return res.status(statusCode).json({
    success: false,
    error:   code,
    message,
    // Stack uniquement en développement
    ...(env.IS_PROD ? {} : { stack: err.stack }),
  });
}

// ── Handler 404 pour routes inconnues ────────────────────
export function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error:   "ROUTE_NOT_FOUND",
    message: `Route ${req.method} ${req.path} introuvable.`,
  });
}