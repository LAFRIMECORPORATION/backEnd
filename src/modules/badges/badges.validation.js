// ============================================================
// LAUNCHPAD — badges/badges.validation.js
// Schémas Zod pour le module Badges
// ============================================================

import { z } from "zod";

const BADGE_KEYS = [
  "kyc_verified",
  "profile_complete",
  "first_project",
  "funded_project",
  "trending_project",
  "first_investment",
  "big_investor",
  "first_forum_post",
  "helpful_member",
  "collaborator",
  "early_adopter",
];

// ── Attribution manuelle d'un badge (admin) ────────────────
export const awardBadgeSchema = z.object({
  badgeKey: z.enum(BADGE_KEYS, {
    errorMap: () => ({
      message: `La clé de badge doit être l'une de : ${BADGE_KEYS.join(", ")}.`,
    }),
  }),
  note: z.string().max(500).optional(),
});

// ── Filtres badges d'un utilisateur ───────────────────────
export const userBadgesQuerySchema = z.object({
  includeUnearned: z.enum(["true", "false"]).optional(),
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
