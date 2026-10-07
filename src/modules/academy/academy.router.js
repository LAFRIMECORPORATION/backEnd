// ============================================================
// LAUNCHPAD — Academy Router
// ============================================================

import express from "express";
import { authenticate, authenticateOptional } from "../../middleware/authenticate.js";
import * as controller from "./academy.controller.js";
import {
  courseCommentSchema,
  courseLikeSchema,
  validate,
} from "./academy.validation.js";

const router = express.Router();

// Published courses and their resources are public; only enrolled actions require login.
router.get("/courses", controller.listCourses);
router.get("/courses/:id", authenticateOptional, controller.getCourse);

// ── Authentifié ─────────────────────────────────────────────────
router.use(authenticate);
router.get("/my-likes", controller.listMyLikes);
router.put("/courses/:id/like", validate(courseLikeSchema), controller.setLike);
router.post("/courses/:id/comments", validate(courseCommentSchema), controller.addComment);
router.post("/courses/:id/enroll", controller.enrollCourse);
router.get("/my-courses", controller.getMyCourses);
router.put("/my-courses/:id/progress", controller.updateProgress);

export default router;
