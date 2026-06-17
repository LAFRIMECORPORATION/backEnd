// ============================================================
// LAUNCHPAD — kyc/kyc.router.js
// Routes du module KYC — Version Modulaire (Option B)
//
// Montage recommandé dans le serveur principal :
//   app.use("/api/kyc", kycRouter);
//   app.use("/api/admin/kyc", kycRouter);
// ============================================================

import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/authorize.js";
import { uploadLimiter } from "../../middleware/rateLimiter.js";
import { validate, rejectKycSchema, requestDocsSchema } from "./kyc.validation.js";
import * as controller from "./kyc.controller.js";
import { AppError } from "../../middleware/errorHandler.js";

const router = Router();

// ── Configuration Multer pour les documents KYC ──────────
const ACCEPTED_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "application/pdf",
];

const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:  10 * 1024 * 1024, // 10 MB max par fichier
    files:     6,                 // Max 6 fichiers à la fois
  },
  fileFilter: (req, file, cb) => {
    if (ACCEPTED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(
        "Format de fichier non accepté. Utilisez JPG, PNG, WebP ou PDF.",
        400,
        "INVALID_FILE_TYPE"
      ));
    }
  },
});

const kycFields = kycUpload.fields([
  // Étudiant
  { name: "cni_file",    maxCount: 1 },
  { name: "selfie",      maxCount: 1 },
  { name: "certif_scol", maxCount: 1 },
  { name: "carte_etu",   maxCount: 1 },
  // Investisseur
  { name: "rep_cni_file", maxCount: 1 },
  { name: "domicile",    maxCount: 1 },
  { name: "rccm_file",   maxCount: 1 },
]);

// ════════════════════════════════════════════════════════════
// 1. ENDPOINTS UTILISATEURS (Accessibles via /api/kyc/*)
// ════════════════════════════════════════════════════════════

// POST /api/kyc/submit — Soumettre son dossier KYC
router.post("/submit",
  authenticate,
  uploadLimiter,
  kycFields,
  controller.submitKyc
);

// GET /api/kyc/status — Voir son statut KYC
router.get("/status",
  authenticate,
  controller.getKycStatus
);

// ════════════════════════════════════════════════════════════
// 2. ENDPOINTS ADMIN (Accessibles via /api/admin/kyc/*)
// ════════════════════════════════════════════════════════════

// GET /api/admin/kyc/stats — Statistiques globales KYC
router.get("/stats",
  authenticate,
  requireRole("admin"),
  controller.getKycStats
);

// GET /api/admin/kyc/pending — Dossiers en attente
router.get("/pending",
  authenticate,
  requireRole("admin"),
  controller.listPendingKyc
);

// GET /api/admin/kyc/:userId — Détail d'un dossier
router.get("/:userId",
  authenticate,
  requireRole("admin"),
  controller.getKycDetail
);

// PUT /api/admin/kyc/:userId/approve — Approuver un dossier
router.put("/:userId/approve",
  authenticate,
  requireRole("admin"),
  controller.approveKyc
);

// PUT /api/admin/kyc/:userId/reject — Rejeter un dossier
router.put("/:userId/reject",
  authenticate,
  requireRole("admin"),
  validate(rejectKycSchema),
  controller.rejectKyc
);

// POST /api/admin/kyc/:userId/request-docs — Demander des pièces complémentaires
router.post("/:userId/request-docs",
  authenticate,
  requireRole("admin"),
  validate(requestDocsSchema),
  controller.requestMoreDocs
);

export default router;