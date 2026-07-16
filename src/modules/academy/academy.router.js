// ============================================================
// LAUNCHPAD — Academy Router
// ============================================================

import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import * as controller from "./academy.controller.js";

const router = express.Router();

// ── Public ─────────────────────────────────────────────────────
router.get("/courses", controller.listCourses);
router.get("/courses/:id", controller.getCourse);

// ── Authentifié ─────────────────────────────────────────────────
router.use(authenticate);
router.post("/courses/:id/enroll", controller.enrollCourse);
router.get("/my-courses", controller.getMyCourses);
router.put("/my-courses/:id/progress", controller.updateProgress);

export default router;
