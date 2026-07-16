// ============================================================
// LAUNCHPAD — admin/admin.validation.js
// Schémas Zod pour le module Administration
// ============================================================

import { z } from "zod";

const emptyToUndefined = (val) =>
  val === "" || (typeof val === "string" && val.trim() === "") ? undefined : val;

// ── Activer / Désactiver un utilisateur ───────────────────
export const toggleUserStatusSchema = z.object({
  reason: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .min(5, "La raison doit contenir au moins 5 caractères.")
      .max(500)
      .optional(),
  ),
});

// ── Approuver un projet ────────────────────────────────────
export const approveProjectSchema = z.object({
  notes:    z.preprocess(emptyToUndefined, z.string().max(1000).optional()),
  featured: z.boolean().optional(),
});

// ── Rejeter un projet ──────────────────────────────────────
export const rejectProjectSchema = z.object({
  reason: z
    .string({ required_error: "La raison du rejet est requise." })
    .min(10, "La raison doit contenir au moins 10 caractères.")
    .max(1000),
});

// ── Filtres liste utilisateurs (admin) ────────────────────
export const adminListUsersQuerySchema = z.object({
  page:   z.string().optional(),
  limit:  z.string().optional(),
  role:   z.enum(["student", "investor", "admin"]).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["active", "inactive", "all"]).optional(),
  kyc:    z.enum(["pending", "submitted", "approved", "rejected", "all"]).optional(),
});

// ── Filtres liste projets (admin) ─────────────────────────
export const adminListProjectsQuerySchema = z.object({
  page:     z.string().optional(),
  limit:    z.string().optional(),
  status:   z
    .enum(["draft", "pending", "active", "funded", "expired", "rejected", "all"])
    .optional(),
  category: z.string().max(100).optional(),
  search:   z.string().max(100).optional(),
});

// ── Filtres audit logs ─────────────────────────────────────
export const auditLogsQuerySchema = z.object({
  page:      z.string().optional(),
  limit:     z.string().optional(),
  adminId:   z.string().uuid("UUID administrateur invalide.").optional(),
  action:    z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate:   z.string().datetime().optional(),
});

// ── Filtres liste investissements (admin) ─────────────────
export const adminListInvestmentsQuerySchema = z.object({
  page:    z.string().optional(),
  limit:   z.string().optional(),
  status:  z.string().optional(),
  method:  z.string().optional(),
  search:  z.string().max(100).optional(),
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
