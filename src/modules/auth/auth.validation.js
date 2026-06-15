// ============================================================
// LAUNCHPAD — auth/auth.validation.js
// Schémas de validation Zod pour l'authentification
// ============================================================

import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string({ required_error: "L'email est requis." })
    .email("Format d'email invalide.")
    .toLowerCase()
    .trim(),

  password: z
    .string({ required_error: "Le mot de passe est requis." })
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre."),

  firstName: z
    .string({ required_error: "Le prénom est requis." })
    .min(2, "Le prénom doit contenir au moins 2 caractères.")
    .max(50, "Le prénom ne doit pas dépasser 50 caractères.")
    .trim(),

  lastName: z
    .string({ required_error: "Le nom est requis." })
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(50, "Le nom ne doit pas dépasser 50 caractères.")
    .trim(),

  role: z.enum(["student", "investor"], {
    errorMap: () => ({ message: "Le rôle doit être 'student' ou 'investor'." }),
  }),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: "L'email est requis." })
    .email("Format d'email invalide.")
    .toLowerCase()
    .trim(),

  password: z
    .string({ required_error: "Le mot de passe est requis." })
    .min(1, "Le mot de passe est requis."),

  role: z.enum(["student", "investor", "admin"]).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: "Le refresh token est requis." })
    .min(1),
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