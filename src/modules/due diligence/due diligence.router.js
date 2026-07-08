// ============================================================
// LAUNCHPAD — due-diligence/due-diligence.router.js
// ============================================================

import express          from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireKyc }   from "../../middleware/authorize.js";
import { apiLimiter }   from "../../middleware/rateLimiter.js";
import * as ctrl        from "./due diligence.controller.js";

const router = express.Router();

// KYC + limite : max 20 analyses/heure par utilisateur
router.use(authenticate, requireKyc, apiLimiter);

// POST /api/due-diligence/analyze
router.post("/analyze", ctrl.analyze);

// GET /api/due-diligence/:projectId
router.get("/:projectId", ctrl.getReport);

export default router;