// ============================================================
// LAUNCHPAD — payments/payments.validation.js
// Validation Zod pour les routes de paiement et escrow
// ============================================================

import { z } from "zod";

export const initMtnSchema = z.object({
  projectId: z.string({ required_error: "L'ID du projet est requis." }).uuid("ID de projet invalide."),
  amount: z.number({ required_error: "Le montant est requis." }).positive("Le montant doit être positif."),
  phoneNumber: z.string({ required_error: "Le numéro de téléphone est requis." }).min(8, "Numéro de téléphone invalide."),
});

export const initOrangeSchema = z.object({
  projectId: z.string({ required_error: "L'ID du projet est requis." }).uuid("ID de projet invalide."),
  amount: z.number({ required_error: "Le montant est requis." }).positive("Le montant doit être positif."),
  phoneNumber: z.string({ required_error: "Le numéro de téléphone est requis." }).min(8, "Numéro de téléphone invalide."),
});

export const initStripeSchema = z.object({
  projectId: z.string({ required_error: "L'ID du projet est requis." }).uuid("ID de projet invalide."),
  amount: z.number({ required_error: "Le montant est requis." }).positive("Le montant doit être positif."),
  currency: z.string().optional(),
});

export const createMilestoneSchema = z.object({
  title: z.string({ required_error: "Le titre est requis." }).min(3, "Le titre doit faire au moins 3 caractères."),
  description: z.string().optional(),
  amountToRelease: z.number({ required_error: "Le montant à libérer est requis." }).positive("Le montant doit être positif."),
  dueDate: z.string({ required_error: "La date d'échéance est requise." }),
});

export const validateMilestoneSchema = z.object({
  notes: z.string().optional(),
});

export const refundInvestmentSchema = z.object({
  reason: z.string({ required_error: "Le motif du remboursement est requis." }).min(5, "Le motif doit faire au moins 5 caractères."),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((error) => ({
        field: error.path.join("."),
        message: error.message,
      }));
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: errors[0]?.message || "Données invalides.",
        errors,
      });
    }
    req.body = result.data;
    next();
  };
}

// Exports pour compatibilité
export const validateInitMtn = validate(initMtnSchema);
export const validateInitOrange = validate(initOrangeSchema);
export const validateInitStripe = validate(initStripeSchema);

// Exports attendus par payments.router.js
export const initMtn = validate(initMtnSchema);
export const initOrange = validate(initOrangeSchema);
export const initStripe = validate(initStripeSchema);
export const createMilestone = validate(createMilestoneSchema);
export const validateMilestone = validate(validateMilestoneSchema);
export const refundInvestment = validate(refundInvestmentSchema);
