// ============================================================
// LAUNCHPAD — feed/feed.validation.js
// Schémas Zod pour le module Feed
// ============================================================

import { z } from "zod";

const FEED_TYPES = [
  "all",
  "projects",
  "investments",
  "forum",
  "collaborations",
  "badges",
  "appointments",
];

// ── Filtres du feed ────────────────────────────────────────
export const feedQuerySchema = z.object({
  page:  z.string().optional(),
  limit: z.string().optional(),
  type:  z.enum(FEED_TYPES, {
    errorMap: () => ({
      message: `Le type de fil doit être l'un de : ${FEED_TYPES.join(", ")}.`,
    }),
  }).optional(),
});

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
