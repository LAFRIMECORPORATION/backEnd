// ============================================================
// LAUNCHPAD — projects/projects.validation.js
// Schémas Zod pour le module Projets — Version Robuste & Anti-Casse
// ============================================================

import { z } from "zod";

// Helper pour normaliser les chaînes en minuscules avant validation Zod
const toLowerPreprocess = (val) => (typeof val === "string" ? val.toLowerCase().trim() : val);

// Helper pour convertir les chaînes numériques en véritables Numbers avant validation Zod
const toNumberPreprocess = (val) => {
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? val : parsed;
  }
  return val;
};

// Helper pour convertir les chaînes d'entiers en véritables Numbers avant validation Zod
const toIntPreprocess = (val) => {
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? val : parsed;
  }
  return val;
};

// Helper pour transformer les chaînes vides en undefined (évite les plantages de contraintes)
const emptyToUndefined = (val) => (val === "" || (typeof val === "string" && val.trim() === "") ? undefined : val);

// ── Création / Mise à jour d'un projet ────────────────────
export const createProjectSchema = z.object({
  title: z
    .string({ required_error: "Le titre est requis." })
    .min(5,  "Le titre doit contenir au moins 5 caractères.")
    .max(200,"Le titre ne doit pas dépasser 200 caractères.")
    .trim(),

  tagline: z
    .string({ required_error: "Le tagline est requis." })
    .min(10,  "Le tagline doit contenir au moins 10 caractères.")
    .max(300, "Le tagline ne doit pas dépasser 300 caractères.")
    .trim(),

  category: z
    .string({ required_error: "La catégorie est requise." })
    .min(2).max(100).trim(),

  description: z
    .string({ required_error: "La description est requise." })
    .min(50,  "La description doit contenir au moins 50 caractères.")
    .max(5000,"La description ne doit pas dépasser 5000 caractères.")
    .trim(),

  problem: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  solution: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  businessModel: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),

  // 🛡️ Gère les majuscules envoyées par le front (ex: "IDEA" -> "idea")
  stage: z.preprocess(
    toLowerPreprocess,
    z.enum(["idea", "prototype", "mvp", "beta", "launched"], {
      errorMap: () => ({ message: "Stade de projet invalide." }),
    })
  ),

  // 🛡️ Accepte les nombres purs ou les chaînes numériques (ex: "2500000" -> 2500000)
  goalAmount: z.preprocess(
    toNumberPreprocess,
    z
      .number({ required_error: "L'objectif de financement est requis." })
      .min(1000000, "L'objectif minimum est de 1 000 000 XAF.")
      .max(10000000000, "L'objectif maximum est de 10 milliards XAF.")
  ),

  // 🛡️ Accepte les nombres purs ou les chaînes numériques si fournies
  equityPct: z.preprocess(
    toNumberPreprocess,
    z
      .number()
      .min(0.1, "Le pourcentage d'equity minimum est 0,1%.")
      .max(100, "Le pourcentage d'equity maximum est 100%.")
      .optional()
  ),

  // 🛡️ Gère la casse pour le type d'equity
  equityType: z.preprocess(
    toLowerPreprocess,
    z.enum(["equity", "revenue_share", "loan", "donation"], {
      errorMap: () => ({ message: "Type de financement invalide." }),
    }).default("equity")
  ),

  deadline: z
    .string()
    .datetime("Format de date invalide. Utilisez ISO 8601.")
    .optional(),

  tags: z
    .array(z.string().min(2).max(50))
    .max(8, "Maximum 8 tags.")
    .default([]),

  githubUrl: z.preprocess(emptyToUndefined, z.string().url("URL GitHub invalide.").optional()),
  demoVideoUrl: z.preprocess(emptyToUndefined, z.string().url("URL vidéo invalide.").optional()),

  // 🛡️ Convertit les chaînes d'entiers si nécessaire
  teamSize: z.preprocess(
    toIntPreprocess,
    z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(1)
  ),
});

// Mise à jour partielle (tous les champs optionnels)
export const updateProjectSchema = createProjectSchema.partial();

// ── Commentaire (Version Multi-Format Sécurisée) ───────────
export const commentSchema = z.preprocess(
  (data) => {
    if (data && typeof data === "object") {
      // 🛡️ FIX : Création d'une copie pour éviter la mutation interdite par Zod
      const updatedData = { ...data };
      if (!updatedData.content && updatedData.text) {
        updatedData.content = updatedData.text;
      }
      return updatedData;
    }
    return data;
  },
  z.object({
    content: z
      .string({ required_error: "Le contenu du commentaire est requis." })
      .min(2,  "Le commentaire doit contenir au moins 2 caractères.")
      .max(1000,"Le commentaire ne doit pas dépasser 1000 caractères.")
      .trim(),
    parentId: z.preprocess(emptyToUndefined, z.string().uuid("ID parent invalide (doit être un UUID).").optional()),
  })
);

// ── Rejet admin ───────────────────────────────────────────
export const adminRejectSchema = z.object({
  reason: z
    .string({ required_error: "La raison du rejet est requise." })
    .min(10, "La raison doit contenir au moins 10 caractères.")
    .max(1000),
});

// ── Approbation admin ─────────────────────────────────────
export const adminApproveSchema = z.object({
  note: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
  featured: z.boolean().optional(),
});

// ── Filtres liste projets ─────────────────────────────────
export const listProjectsQuerySchema = z.object({
  page:      z.string().optional(),
  limit:     z.string().optional(),
  category:  z.string().optional(),
  stage:     z.preprocess(toLowerPreprocess, z.enum(["idea", "prototype", "mvp", "beta", "launched"]).optional()),
  minGoal:   z.string().optional(),
  maxGoal:   z.string().optional(),
  search:    z.string().max(100).optional(),
  sort:      z.preprocess(toLowerPreprocess, z.enum(["recent", "popular", "funded", "deadline"]).optional()),
  status:    z.preprocess(toLowerPreprocess, z.enum(["draft", "pending", "active", "funded", "expired", "rejected"]).optional()),
  authorId:  z.string().uuid("ID auteur invalide (doit être un UUID).").optional(),
});

// ── Middleware de validation body ──────────────────────────────
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
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

// ── Middleware de validation query params ─────────────────
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
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