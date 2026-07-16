// ============================================================
// LAUNCHPAD — users/users.validation.js
// Schémas Zod pour le module Utilisateurs
// ============================================================

import { z } from "zod";

const emptyToUndefined = (val) =>
  val === "" || (typeof val === "string" && val.trim() === "") ? undefined : val;

// ── Mise à jour du profil ──────────────────────────────────
export const updateUserSchema = z.object({
  firstName: z
    .string()
    .min(2, "Le prénom doit contenir au moins 2 caractères.")
    .max(50, "Le prénom ne doit pas dépasser 50 caractères.")
    .trim()
    .optional(),

  lastName: z
    .string()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(50, "Le nom ne doit pas dépasser 50 caractères.")
    .trim()
    .optional(),

  bio: z.preprocess(
    emptyToUndefined,
    z.string().max(500, "La bio ne doit pas dépasser 500 caractères.").optional(),
  ),

  profile: z
    .object({
      university:  z.preprocess(emptyToUndefined, z.string().max(200).optional()),
      company:     z.preprocess(emptyToUndefined, z.string().max(200).optional()),
      location:    z.preprocess(emptyToUndefined, z.string().max(200).optional()),
      linkedinUrl: z.preprocess(emptyToUndefined, z.string().url("URL LinkedIn invalide.").optional()),
      githubUrl:   z.preprocess(emptyToUndefined, z.string().url("URL GitHub invalide.").optional()),
      websiteUrl:  z.preprocess(emptyToUndefined, z.string().url("URL site invalide.").optional()),
      skills: z
        .array(z.string().min(1).max(50))
        .max(20, "Maximum 20 compétences.")
        .optional(),
      interests: z
        .array(z.string().min(1).max(50))
        .max(20, "Maximum 20 centres d'intérêt.")
        .optional(),
      investmentMin: z.number().min(0).optional(),
      investmentMax: z.number().min(0).optional(),
      sectors:       z.array(z.string()).max(10).optional(),
    })
    .optional(),
});

// ── Filtres liste utilisateurs (admin) ────────────────────
export const listUsersQuerySchema = z.object({
  page:   z.string().optional(),
  limit:  z.string().optional(),
  role:   z.enum(["student", "investor", "admin"]).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["active", "inactive"]).optional(),
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

// ── Middleware de validation query ─────────────────────────
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
