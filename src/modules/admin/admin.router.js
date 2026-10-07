// ============================================================
// LAUNCHPAD — admin/admin.router.js
// Toutes les routes admin protégées par authenticate + requireRole
// ============================================================

import express          from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole }  from "../../middleware/authorize.js";
import * as ctrl        from "./admin.controller.js";
import * as academyCtrl from "../academy/academy.controller.js";
import {
	createCourseSchema,
	updateCourseSchema,
	validate as validateAcademyCourse,
} from "../academy/academy.validation.js";
import {
	validate,
	toggleUserStatusSchema,
	approveProjectSchema,
	rejectProjectSchema,
	validateQuery,
	auditLogsQuerySchema,
	adminListInvestmentsQuerySchema,
	investmentRefundSchema,
	adminForumQuerySchema,
} from "./admin.validation.js";
import {
	createPostSchema,
	updatePostSchema,
	validate as validateForumPost,
} from "../forum/forum.validation.js";

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

// Investissements, Academy et Forum
router.get("/investments-control", validateQuery(adminListInvestmentsQuerySchema), ctrl.getInvestmentsControl);
router.post("/investments/:id/refund", validate(investmentRefundSchema), ctrl.refundInvestment);
router.get("/academy-control",                      ctrl.getAcademyControl);
router.get("/academy/courses",                      academyCtrl.listAdminCourses);
router.post("/academy/courses", validateAcademyCourse(createCourseSchema), academyCtrl.createCourse);
router.put("/academy/courses/:id", validateAcademyCourse(updateCourseSchema), academyCtrl.updateCourse);
router.delete("/academy/courses/:id",               academyCtrl.deleteCourse);
router.get("/forum-control", validateQuery(adminForumQuerySchema), ctrl.getForumControl);
router.post("/forum/posts", validateForumPost(createPostSchema), ctrl.createAdminForumPost);
router.put("/forum/posts/:id", validateForumPost(updatePostSchema), ctrl.updateAdminForumPost);
router.put("/forum/posts/:id/pin",                  ctrl.toggleForumPin);
router.delete("/forum/posts/:id",                   ctrl.deleteForumPost);
router.put("/forum/posts/:id/restore",               ctrl.restoreForumPost);

// Audit
router.get("/audit-logs",           validateQuery(auditLogsQuerySchema), ctrl.getAuditLogs);

export default router;