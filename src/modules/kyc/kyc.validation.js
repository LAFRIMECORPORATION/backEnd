// ============================================================
// LAUNCHPAD — kyc/kyc.validation.js
// Schémas de validation Zod pour le module KYC
// ============================================================

import { z } from "zod";

// ── Soumission KYC Étudiant ────────────────────────────────
export const submitKycStudentSchema = z.object({
  // Identité
  cniNumber:    z.string().min(5, "Numéro CNI invalide.").max(20),
  // Scolarité
  university:   z.string().min(3, "Établissement requis.").max(200),
  matricule:    z.string().min(3, "Numéro matricule requis.").max(50),
  level:        z.enum([
    "Licence 1","Licence 2","Licence 3",
    "Master 1","Master 2","Doctorat",
    "BTS 1","BTS 2","DUT","Classe préparatoire"
  ], { errorMap: () => ({ message: "Niveau d'études invalide." }) }),
});

// ── Soumission KYC Investisseur ───────────────────────────
export const submitKycInvestorSchema = z.object({
  // Représentant
  repName:      z.string().min(3, "Nom du représentant requis.").max(100),
  repCni:       z.string().min(5, "Numéro CNI représentant invalide.").max(20),
  // Entreprise
  entityName:   z.string().min(2, "Nom de l'entité requis.").max(200),
  entityType:   z.enum([
    "Entreprise (SARL / SA / SAS)",
    "Fonds d'investissement",
    "Association / ONG",
    "Business Angel (particulier)",
    "Family Office",
  ]),
  rccm:         z.string().max(50).optional(),
});

// ── Rejet KYC (admin) ────────────────────────────────────
export const rejectKycSchema = z.object({
  reason: z
    .string({ required_error: "La raison du rejet est requise." })
    .min(10, "La raison doit contenir au moins 10 caractères.")
    .max(1000),
});

// ── Demande de documents supplémentaires ─────────────────
export const requestDocsSchema = z.object({
  missingDocs: z
    .array(z.string().min(2))
    .min(1, "Spécifiez au moins un document manquant."),
  message: z
    .string()
    .max(500)
    .optional(),
});

// ── Middleware de validation générique ────────────────────
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