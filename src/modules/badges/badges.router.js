// ============================================================
// LAUNCHPAD — badges/badges.router.js
// ============================================================

import express          from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole }  from "../../middleware/authorize.js";
import * as ctrl        from "./badges.controller.js";

const router = express.Router();

// GET /api/badges/me — Mes badges
router.get("/me",                          authenticate, ctrl.getMyBadges);

// GET /api/badges/user/:id — Badges d'un utilisateur
router.get("/user/:id",                    ctrl.getUserBadges);

// POST /api/badges/award/:userId/:badgeKey — [ADMIN/INTERNE]
router.post("/award/:userId/:badgeKey",    authenticate, requireRole(["admin"]), ctrl.awardBadge);

export default router;