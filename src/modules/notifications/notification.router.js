// ============================================================
// LAUNCHPAD — notifications/notifications.router.js
// ============================================================

import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import * as ctrl from "./router.controller.js";

const router = express.Router();

// Toutes les routes nécessitent auth
router.use(authenticate);

router.get("/", ctrl.list);
router.get("/unread-count", ctrl.unreadCount);
router.put("/mark-all-read", ctrl.markAllRead);
router.put("/:id/read", ctrl.markOneRead);
router.delete("/:id", ctrl.remove);
router.post("/push/subscribe", ctrl.subscribePush);
router.delete("/push/unsubscribe", ctrl.unsubscribePush);

export default router;
