// ============================================================
// LAUNCHPAD — due diligence/due-diligence.validation.js
// Schémas Zod pour le module Due Diligence
// ============================================================

import { z } from "zod";

// ── Lancer une analyse ─────────────────────────────────────
export const analyzeSchema = z.object({
  projectId: z
    .string({ required_error: "L'identifiant du projet est requis." })
    .uuid("L'identifiant du projet doit être un UUID valide."),
});

// ── Filtres / options d'analyse ────────────────────────────
export const analyzeQuerySchema = z.object({
  force: z.enum(["true", "false"]).optional(), // Forcer un rechargement sans cache
});

// ── Middleware de validation body ──────────────────────────
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field:   e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        error:   "VALIDATION_ERROR",
        message: errors[0]?.message || "Données invalides.",
        errors,
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field:   e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        error:   "VALIDATION_ERROR",
        message: errors[0]?.message || "Paramètres invalides.",
        errors,
      });
    }
    req.query = result.data;
    next();
  };
}
