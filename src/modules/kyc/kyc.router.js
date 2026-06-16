// ============================================================
// LAUNCHPAD — kyc/kyc.router.js
// Routes du module KYC
//
// Routes utilisateur :
//   POST /api/kyc/submit
//   GET  /api/kyc/status
//
// Routes admin :
//   GET  /api/admin/kyc/stats
//   GET  /api/admin/kyc/pending
//   GET  /api/admin/kyc/:userId
//   PUT  /api/admin/kyc/:userId/approve
//   PUT  /api/admin/kyc/:userId/reject
//   POST /api/admin/kyc/:userId/request-docs
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
// Stockage en mémoire → on envoie le buffer à Cloudinary
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

// Champs attendus selon le rôle (le router accepte tous,
// le service vérifie les requis selon le rôle)
const kycFields = kycUpload.fields([
  // Étudiant
  { name: "cni_file",   maxCount: 1 },
  { name: "selfie",     maxCount: 1 },
  { name: "certif_scol",maxCount: 1 },
  { name: "carte_etu",  maxCount: 1 },
  // Investisseur
  { name: "rep_cni_file",maxCount: 1 },
  { name: "domicile",    maxCount: 1 },
  { name: "rccm_file",   maxCount: 1 },
]);

// ════════════════════════════════════════════════════════════
// ROUTES UTILISATEUR
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
// ROUTES ADMIN
// ════════════════════════════════════════════════════════════

// GET /api/admin/kyc/stats — Statistiques globales KYC
router.get("/admin/stats",
  authenticate,
  requireRole("admin"),
  controller.getKycStats
);

// GET /api/admin/kyc/pending — Dossiers en attente
router.get("/admin/pending",
  authenticate,
  requireRole("admin"),
  controller.listPendingKyc
);

// GET /api/admin/kyc/:userId — Détail d'un dossier
router.get("/admin/:userId",
  authenticate,
  requireRole("admin"),
  controller.getKycDetail
);

// PUT /api/admin/kyc/:userId/approve — Approuver
router.put("/admin/:userId/approve",
  authenticate,
  requireRole("admin"),
  controller.approveKyc
);

// PUT /api/admin/kyc/:userId/reject — Rejeter
router.put("/admin/:userId/reject",
  authenticate,
  requireRole("admin"),
  validate(rejectKycSchema),
  controller.rejectKyc
);

// POST /api/admin/kyc/:userId/request-docs — Demander docs supplémentaires
router.post("/admin/:userId/request-docs",
  authenticate,
  requireRole("admin"),
  validate(requestDocsSchema),
  controller.requestMoreDocs
);

export default router;