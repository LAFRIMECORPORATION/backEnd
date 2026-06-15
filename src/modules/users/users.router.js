// ============================================================
// LAUNCHPAD — users/users.router.js
// Routes utilisateurs
// ============================================================

import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole, requireOwnerOrAdmin } from "../../middleware/authorize.js";
import { success, paginated, getPagination } from "../../utils/response.js";
import * as usersService from "./users.service.js";
import { AppError } from "../../middleware/errorHandler.js";

const router = Router();

// Multer en mémoire (on envoie le buffer à Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new AppError("Seules les images sont acceptées.", 400, "INVALID_FILE_TYPE"));
    }
  },
});

// GET /api/users — Liste (admin seulement)
router.get("/",
  authenticate,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { page, limit } = getPagination(req.query);
      const { role, search } = req.query;
      const { users, total } = await usersService.listUsers({ page, limit, role, search });
      return paginated(res, { data: users, page, limit, total });
    } catch (e) { next(e); }
  }
);

// GET /api/users/:id — Profil public
router.get("/:id",
  authenticate,
  async (req, res, next) => {
    try {
      const user = await usersService.getUserById(req.params.id);
      return success(res, { user });
    } catch (e) { next(e); }
  }
);

// PUT /api/users/:id — Modifier son profil
router.put("/:id",
  authenticate,
  requireOwnerOrAdmin("id"),
  async (req, res, next) => {
    try {
      const user = await usersService.updateUser(req.params.id, req.body, req.user.id);
      return success(res, { user }, "Profil mis à jour avec succès.");
    } catch (e) { next(e); }
  }
);

// POST /api/users/:id/avatar — Changer l'avatar
router.post("/:id/avatar",
  authenticate,
  requireOwnerOrAdmin("id"),
  upload.single("avatar"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError("Aucun fichier fourni.", 400, "NO_FILE");
      }
      const user = await usersService.updateAvatar(req.params.id, req.file.buffer);
      return success(res, { user }, "Avatar mis à jour.");
    } catch (e) { next(e); }
  }
);

export default router;