// ============================================================
// LAUNCHPAD — admin/admin.router.js
// Toutes les routes admin protégées par authenticate + requireRole
// ============================================================

import express          from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole }  from "../../middleware/authorize.js";
import * as ctrl        from "./admin.controller.js";

const router = express.Router();

// Toutes les routes admin nécessitent auth + rôle admin
router.use(authenticate, requireRole(["admin"]));

// Statistiques
router.get("/statistics",           ctrl.getStatistics);

// Utilisateurs
router.get("/users",                ctrl.listUsers);
router.put("/users/:id/toggle-status", ctrl.toggleUserStatus);

// Projets
router.get("/projects",             ctrl.listProjects);
router.put("/projects/:id/approve", ctrl.approveProject);
router.put("/projects/:id/reject",  ctrl.rejectProject);

// Audit
router.get("/audit-logs",           ctrl.getAuditLogs);

export default router;