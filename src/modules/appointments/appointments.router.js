// ============================================================
// LAUNCHPAD — appointments/appointments.router.js
// ============================================================

import express          from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireKyc }   from "../../middleware/authorize.js";
import * as ctrl        from "./appointments.controller.js";

const router = express.Router();

// Disponibilités (public)
router.get("/availability/:userId", ctrl.availability);

// Routes protégées (KYC obligatoire)
router.use(authenticate, requireKyc);

router.get("/",           ctrl.list);
router.get("/:id",        ctrl.getOne);
router.post("/",          ctrl.create);
router.put("/:id/confirm",  ctrl.confirm);
router.put("/:id/cancel",   ctrl.cancel);
router.put("/:id/complete", ctrl.complete);

export default router;