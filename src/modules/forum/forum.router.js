// ============================================================
// LAUNCHPAD — forum/forum.router.js
// ============================================================

import express          from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole }  from "../../middleware/authorize.js";
import { apiLimiter }   from "../../middleware/rateLimiter.js";
import * as ctrl        from "./forum.controller.js";

const router = express.Router();

// ── Routes publiques (lecture) ────────────────────────────────
router.get("/posts",        ctrl.listPosts);
router.get("/posts/:id",    ctrl.getPost);

// ── Routes authentifiées ──────────────────────────────────────
router.post("/posts",                    authenticate, apiLimiter, ctrl.createPost);
router.put("/posts/:id",                 authenticate, ctrl.updatePost);
router.delete("/posts/:id",              authenticate, ctrl.deletePost);
router.post("/posts/:id/like",           authenticate, ctrl.toggleLike);
router.post("/posts/:id/replies",        authenticate, apiLimiter, ctrl.addReply);
router.post("/replies/:replyId/like",    authenticate, ctrl.toggleReplyLike);

// ── Routes admin ──────────────────────────────────────────────
router.put("/posts/:id/pin", authenticate, requireRole(["admin"]), ctrl.togglePin);

export default router;