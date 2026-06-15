// ============================================================
// LAUNCHPAD — auth/auth.router.js
// Routes d'authentification
// ============================================================

import { Router } from "express";
import * as controller from "./auth.controller.js";
import { validate, registerSchema, loginSchema, refreshTokenSchema } from "./auth.validation.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authLimiter } from "../../middleware/rateLimiter.js";

const router = Router();

// POST /api/auth/register
router.post("/register",
  authLimiter,
  validate(registerSchema),
  controller.register
);

// POST /api/auth/login
router.post("/login",
  authLimiter,
  validate(loginSchema),
  controller.login
);

// POST /api/auth/refresh-token
router.post("/refresh-token",
  validate(refreshTokenSchema),
  controller.refreshToken
);

// POST /api/auth/logout  (nécessite d'être connecté)
router.post("/logout",
  authenticate,
  controller.logout
);

// GET /api/auth/me  (profil de l'utilisateur connecté)
router.get("/me",
  authenticate,
  controller.getMe
);

export default router;