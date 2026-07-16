// ============================================================
// LAUNCHPAD — notifications/notifications.validation.js
// Schémas Zod pour le module Notifications
// ============================================================

import { z } from "zod";

// ── Filtres liste notifications ────────────────────────────
export const listNotificationsQuerySchema = z.object({
  page:       z.string().optional(),
  limit:      z.string().optional(),
  unreadOnly: z.enum(["true", "false"]).optional(),
});

// ── Abonnement Push (VAPID) ────────────────────────────────
export const subscribePushSchema = z.object({
  endpoint: z
    .string({ required_error: "L'endpoint est requis." })
    .url("L'endpoint doit être une URL valide."),

  keys: z.object({
    p256dh: z.string({ required_error: "La clé p256dh est requise." }).min(1),
    auth:   z.string({ required_error: "La clé auth est requise." }).min(1),
  }),

  expirationTime: z.number().nullable().optional(),
});

// ── Désabonnement Push ─────────────────────────────────────
export const unsubscribePushSchema = z.object({
  endpoint: z
    .string({ required_error: "L'endpoint est requis." })
    .url("L'endpoint doit être une URL valide."),
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
