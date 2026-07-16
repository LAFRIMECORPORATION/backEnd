// ============================================================
// LAUNCHPAD — forum/forum.validation.js
// Schémas Zod pour le module Forum
// ============================================================

import { z } from "zod";

const CATEGORIES = [
  "general",
  "financement",
  "juridique",
  "tech",
  "marketing",
  "success-stories",
  "questions",
  "annonces",
];

const emptyToUndefined = (val) =>
  val === "" || (typeof val === "string" && val.trim() === "") ? undefined : val;

// ── Création d'un post ─────────────────────────────────────
export const createPostSchema = z.object({
  title: z
    .string({ required_error: "Le titre est requis." })
    .min(5, "Le titre doit contenir au moins 5 caractères.")
    .max(200, "Le titre ne doit pas dépasser 200 caractères.")
    .trim(),

  content: z
    .string({ required_error: "Le contenu est requis." })
    .min(20, "Le contenu doit contenir au moins 20 caractères.")
    .max(10000, "Le contenu ne doit pas dépasser 10 000 caractères.")
    .trim(),

  category: z.enum(CATEGORIES, {
    errorMap: () => ({
      message: `La catégorie doit être l'une de : ${CATEGORIES.join(", ")}.`,
    }),
  }),

  tags: z
    .array(z.string().min(2).max(50))
    .max(8, "Maximum 8 tags.")
    .default([]),
});

// ── Modification d'un post ─────────────────────────────────
export const updatePostSchema = createPostSchema.partial();

// ── Réponse à un post ──────────────────────────────────────
export const replySchema = z.object({
  content: z
    .string({ required_error: "Le contenu de la réponse est requis." })
    .min(2, "La réponse doit contenir au moins 2 caractères.")
    .max(5000, "La réponse ne doit pas dépasser 5 000 caractères.")
    .trim(),
});

// ── Filtres liste posts ────────────────────────────────────
export const listPostsQuerySchema = z.object({
  page:     z.string().optional(),
  limit:    z.string().optional(),
  category: z.preprocess(emptyToUndefined, z.enum(CATEGORIES).optional()),
  search:   z.string().max(100).optional(),
  sort:     z.enum(["recent", "popular", "unanswered"]).optional(),
  pinned:   z.enum(["true", "false"]).optional(),
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
