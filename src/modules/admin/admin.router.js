// ============================================================
// LAUNCHPAD — admin/admin.router.js
// Toutes les routes admin protégées par authenticate + requireRole
// ============================================================

import express          from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole }  from "../../middleware/authorize.js";
import * as ctrl        from "./admin.controller.js";
import {
	validate,
	toggleUserStatusSchema,
	approveProjectSchema,
	rejectProjectSchema,
	validateQuery,
	auditLogsQuerySchema,
} from "./admin.validation.js";

const router = express.Router();

// Toutes les routes admin nécessitent auth + rôle admin
router.use(authenticate, requireRole("admin"));

// Statistiques
router.get("/statistics",           ctrl.getStatistics);

// Utilisateurs
router.get("/users",                ctrl.listUsers);
router.put("/users/:id/toggle-status", validate(toggleUserStatusSchema), ctrl.toggleUserStatus);
router.delete("/users/:id",              ctrl.deleteUser);

// Projets
router.get("/projects",             ctrl.listProjects);
router.put("/projects/:id/approve", validate(approveProjectSchema), ctrl.approveProject);
router.put("/projects/:id/reject",  validate(rejectProjectSchema), ctrl.rejectProject);
router.delete("/projects/:id",       ctrl.deleteProject);

// Marketplace
router.get("/marketplace",                         ctrl.getMarketplaceOverview);
router.put("/marketplace/applications/:id/status", ctrl.updateMarketplaceApplication);
router.delete("/marketplace/offers/:id",           ctrl.deleteMarketplaceOffer);

// Audit
router.get("/audit-logs",           validateQuery(auditLogsQuerySchema), ctrl.getAuditLogs);

export default router;