// ============================================================
// LAUNCHPAD — payments/payments.validation.js
// Validation Zod de tous les inputs paiement
// ============================================================

import { z }        from "zod";
import { AppError } from "../../middleware/errorHandler.js";

// ── Helper : exécuter la validation et passer au next ────────
function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      return next(new AppError(message, 400, "VALIDATION_ERROR"));
    }
    req.body = result.data;
    next();
  };
}

// ── Montants XAF ─────────────────────────────────────────────
// Min : 5 000 XAF (~8€) — Max : 50 000 000 XAF (~75k€)
const amountSchema = z
  .number({ required_error: "Le montant est requis." })
  .int("Le montant doit être un entier (en XAF).")
  .min(5_000,  "Le montant minimum est de 5 000 XAF.")
  .max(50_000_000, "Le montant maximum est de 50 000 000 XAF.");

// ── Numéro de téléphone camerounais ──────────────────────────
// Format : 6XXXXXXXX (9 chiffres sans le +237)
const phoneSchema = z
  .string()
  .regex(/^6[2-9]\d{7}$/, "Numéro invalide. Format attendu : 6XXXXXXXX (sans +237).");

// ────────────────────────────────────────────────────────────
// MTN Mobile Money
// ────────────────────────────────────────────────────────────
export const initMtn = validate(
  z.object({
    projectId:   z.string().uuid("projectId invalide."),
    amount:      amountSchema,
    phoneNumber: phoneSchema,
  })
);

// ────────────────────────────────────────────────────────────
// Orange Money
// ────────────────────────────────────────────────────────────
export const initOrange = validate(
  z.object({
    projectId:   z.string().uuid("projectId invalide."),
    amount:      amountSchema,
    phoneNumber: phoneSchema,
  })
);

// ────────────────────────────────────────────────────────────
// Stripe
// ────────────────────────────────────────────────────────────
export const initStripe = validate(
  z.object({
    projectId: z.string().uuid("projectId invalide."),
    amount:    amountSchema,
    currency:  z.enum(["XAF", "EUR", "USD"]).default("XAF"),
  })
);

// ────────────────────────────────────────────────────────────
// Escrow — Créer un milestone
// ────────────────────────────────────────────────────────────
export const createMilestone = validate(
  z.object({
    title:           z.string().min(3).max(100),
    description:     z.string().max(500).optional(),
    amountToRelease: z
      .number()
      .int()
      .positive("Le montant à libérer doit être positif."),
    dueDate: z
      .string()
      .datetime("Format date invalide. Utiliser ISO 8601.")
      .refine(d => new Date(d) > new Date(), "La date doit être dans le futur."),
  })
);

// ────────────────────────────────────────────────────────────
// Escrow — Valider un milestone
// ────────────────────────────────────────────────────────────
export const validateMilestone = validate(
  z.object({
    notes: z.string().max(500).optional(),
  })
);

// ────────────────────────────────────────────────────────────
// Escrow — Rembourser un investissement
// ────────────────────────────────────────────────────────────
export const refundInvestment = validate(
  z.object({
    reason: z
      .string()
      .min(10, "La raison du remboursement doit faire au moins 10 caractères.")
      .max(500),
  })
);