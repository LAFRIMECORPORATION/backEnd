// ============================================================
// LAUNCHPAD — collaborations/collaborations.validation.js
// Schémas Zod pour le module Collaborations
// ============================================================

import { z } from "zod";

const emptyToUndefined = (val) =>
  val === "" || (typeof val === "string" && val.trim() === "") ? undefined : val;

// ── Envoi d'une demande de collaboration ──────────────────
export const sendCollaborationSchema = z.object({
  projectId: z
    .string({ required_error: "L'identifiant du projet est requis." })
    .uuid("L'identifiant du projet doit être un UUID valide."),

  targetUserId: z
    .string({ required_error: "L'identifiant du destinataire est requis." })
    .uuid("L'identifiant du destinataire doit être un UUID valide."),

  message: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .min(10, "Le message doit contenir au moins 10 caractères.")
      .max(1000, "Le message ne doit pas dépasser 1 000 caractères.")
      .optional(),
  ),

  skills: z
    .array(z.string().min(1).max(50))
    .max(10, "Maximum 10 compétences.")
    .optional(),

  role: z.preprocess(
    emptyToUndefined,
    z.string().max(100, "Le rôle proposé ne doit pas dépasser 100 caractères.").optional(),
  ),
});

// ── Refus d'une demande de collaboration ──────────────────
export const declineCollaborationSchema = z.object({
  reason: z.preprocess(
    emptyToUndefined,
    z.string().max(500, "La raison ne doit pas dépasser 500 caractères.").optional(),
  ),
});

// ── Filtres inbox ──────────────────────────────────────────
export const collaborationInboxQuerySchema = z.object({
  status: z.enum(["pending", "accepted", "declined", "all"]).optional(),
  type:   z.enum(["sent", "received", "all"]).optional(),
  page:   z.string().optional(),
  limit:  z.string().optional(),
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
