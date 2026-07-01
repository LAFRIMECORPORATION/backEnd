// ============================================================
// LAUNCHPAD — messages/messages.router.js
// ============================================================

import { Router }       from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { apiLimiter }   from "../../middleware/rateLimiter.js";
import { validate, sendMessageSchema, createDirectConvSchema } from "./messages.validation.js";
import * as ctrl from "./messages.controller.js";

const router = Router();
router.use(authenticate);

// Conversations
router.post("/conversations/direct",     validate(createDirectConvSchema), ctrl.createDirectConversation);
router.get("/conversations",             ctrl.listConversations);
router.get("/conversations/:id/messages",ctrl.getMessages);
router.post("/conversations/:id/read",   ctrl.markRead);

// Messages
router.post("/messages",   apiLimiter, validate(sendMessageSchema), ctrl.sendMessage);
router.delete("/messages/:id", ctrl.deleteMessage);
router.get("/messages/unread-count", ctrl.getUnreadCount);

export default router;