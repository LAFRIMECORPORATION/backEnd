// ============================================================
// LAUNCHPAD — projects/projects.router.js
// Routes du module Projets — Version Corrigée (Priorité Admin & Fix 404)
// ============================================================

import { Router } from "express";
import multer from "multer";
import { authenticate, authenticateOptional } from "../../middleware/authenticate.js";
import { requireRole, requireKyc } from "../../middleware/authorize.js";
import { uploadLimiter, publicLimiter, similarLimiter } from "../../middleware/rateLimiter.js";
import {
  validate, validateQuery,
  createProjectSchema, updateProjectSchema,
  commentSchema, adminRejectSchema, adminApproveSchema,
  listProjectsQuerySchema,
} from "./projects.validation.js";
import * as controller from "./projects.controller.js";
import { AppError } from "../../middleware/errorHandler.js";

const router = Router();

// Multer cover image
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (["image/jpeg","image/png","image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new AppError("Seuls JPG, PNG et WebP sont acceptés.", 400, "INVALID_FILE_TYPE"));
  },
});

// ============================================================
// 1. ── Routes Relatives à l'Admin (À ENREGISTRER EN PREMIER 🚀)
// ============================================================
// Grâce au montage sur /api/admin/projects dans server.js, l'ordre ici évite le conflit avec /:id
router.get("/pending",       authenticate, requireRole("admin"), controller.listPendingProjects);
router.put("/:id/approve",   authenticate, requireRole("admin"), validate(adminApproveSchema), controller.approveProject);
router.put("/:id/reject",    authenticate, requireRole("admin"), validate(adminRejectSchema), controller.rejectProject);

// ============================================================
// 2. ── Routes Communes / Utilisateurs Fixes
// ============================================================
router.get("/",              publicLimiter, authenticateOptional, validateQuery(listProjectsQuerySchema), controller.listProjects);
router.get("/mine",          authenticate, requireRole("student","admin"), controller.listMyProjects);
router.post("/",             authenticate, requireRole("student","admin"), validate(createProjectSchema), controller.createProject);

// ============================================================
// 3. ── Routes Dynamiques Utilisateurs (À ENREGISTRER EN DERNIER ⚠️)
// ============================================================
router.get("/:id",           publicLimiter, authenticateOptional, controller.getProjectById);
router.get("/:id/comments",  publicLimiter, controller.getComments);
router.get("/:id/similar",   similarLimiter, controller.getSimilarProjects);

// 📸 Intercepte la clé "cover" envoyée par le FormData Front-end
router.post("/:id/cover",    authenticate, requireRole("student","admin"), requireKyc, uploadLimiter, coverUpload.single("cover"), controller.uploadCover);

router.post("/:id/publish",  authenticate, requireRole("student"), requireKyc, controller.publishProject);
router.put("/:id",           authenticate, requireRole("student","admin"), validate(updateProjectSchema), controller.updateProject);
router.delete("/:id",        authenticate, requireRole("student","admin"), controller.deleteProject);
router.post("/:id/like",           authenticate, controller.toggleLike);
router.post("/:id/save",           authenticate, controller.toggleSave);
router.post("/:id/comments",       authenticate, validate(commentSchema), controller.addComment);
router.post("/:id/comments/:commentId/like", authenticate, controller.toggleCommentLike);

export default router;