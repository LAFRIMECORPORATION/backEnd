// ============================================================
// LAUNCHPAD — Push Subscriptions Router
// ============================================================

import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import * as controller from "./push.controller.js";

const router = express.Router();

// ── Authentifié ─────────────────────────────────────────────────
router.use(authenticate);
router.post("/subscribe", controller.subscribe);
router.delete("/unsubscribe", controller.unsubscribe);
router.get("/my-subscriptions", controller.getMySubscriptions);

export default router;
