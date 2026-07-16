// ============================================================
// LAUNCHPAD — appointments/appointments.validation.js
// Schémas Zod pour le module Rendez-vous
// ============================================================

import { z } from "zod";

const emptyToUndefined = (val) =>
  val === "" || (typeof val === "string" && val.trim() === "") ? undefined : val;

// ── Créneau horaire proposé ────────────────────────────────
const slotSchema = z.object({
  date:  z
    .string({ required_error: "La date du créneau est requise." })
    .datetime("Format de date invalide. Utilisez ISO 8601."),
  label: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
});

// ── Création d'un rendez-vous ──────────────────────────────
export const createAppointmentSchema = z.object({
  targetUserId: z
    .string({ required_error: "L'identifiant du destinataire est requis." })
    .uuid("L'identifiant du destinataire doit être un UUID valide."),

  projectId: z.preprocess(
    emptyToUndefined,
    z.string().uuid("L'identifiant du projet doit être un UUID valide.").optional(),
  ),

  type: z.enum(["pitch", "due_diligence", "suivi", "general"], {
    errorMap: () => ({ message: "Le type doit être : pitch, due_diligence, suivi ou general." }),
  }).default("general"),

  format: z.enum(["video", "phone", "in_person"], {
    errorMap: () => ({ message: "Le format doit être : video, phone ou in_person." }),
  }).default("video"),

  message: z.preprocess(
    emptyToUndefined,
    z.string().max(1000, "Le message ne doit pas dépasser 1 000 caractères.").optional(),
  ),

  proposedSlots: z
    .array(slotSchema)
    .min(1, "Au moins un créneau doit être proposé.")
    .max(3, "Maximum 3 créneaux peuvent être proposés."),
});

// ── Annulation d'un rendez-vous ────────────────────────────
export const cancelAppointmentSchema = z.object({
  reason: z.preprocess(
    emptyToUndefined,
    z.string().max(500, "La raison ne doit pas dépasser 500 caractères.").optional(),
  ),
});

// ── Confirmation d'un rendez-vous (choix du créneau) ──────
export const confirmAppointmentSchema = z.object({
  slotIndex: z
    .number({ required_error: "L'index du créneau est requis." })
    .int()
    .min(0)
    .max(2)
    .optional(),
});

// ── Disponibilités (query) ─────────────────────────────────
export const availabilityQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Le format de date doit être YYYY-MM-DD.")
    .optional(),
});

// ── Filtres liste rendez-vous ──────────────────────────────
export const listAppointmentsQuerySchema = z.object({
  tab:   z.enum(["upcoming", "past", "all"]).optional(),
  page:  z.string().optional(),
  limit: z.string().optional(),
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
