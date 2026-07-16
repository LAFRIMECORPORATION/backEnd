// ============================================================
// LAUNCHPAD — Reports Router
// ============================================================

import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import * as controller from "./reports.controller.js";

const router = express.Router();

// ── Authentifié ─────────────────────────────────────────────────
router.use(authenticate);
router.post("/", controller.createReport);
router.get("/my-reports", controller.getMyReports);

// ── Admin ───────────────────────────────────────────────────────
router.get("/", controller.listReports);
router.get("/:id", controller.getReport);
router.put("/:id/status", controller.updateReportStatus);

export default router;
