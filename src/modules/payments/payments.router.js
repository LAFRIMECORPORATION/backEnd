// ============================================================
// LAUNCHPAD — payments/payments.router.js
// Routes paiements : MTN · Orange · Stripe · Escrow · Investments
//
// IMPORTANT : Le webhook Stripe utilise express.raw() pour
// lire le corps brut (nécessaire pour vérifier la signature).
// Ce middleware est appliqué AVANT express.json() global.
// ============================================================

import express           from "express";
import { authenticate }  from "../../middleware/authenticate.js";
import { requireRole }   from "../../middleware/authorize.js";
import { requireKyc }    from "../../middleware/authorize.js";
import { paymentLimiter, webhookLimiter } from "../../middleware/rateLimiter.js";
import * as validate     from "./payments.validation.js";
import * as ctrl         from "./payments.controller.js";

const router = express.Router();

// ════════════════════════════════════════════════════════════
// WEBHOOKS — Routes publiques (appelées par MTN/Orange/Stripe)
// Doivent être AVANT les middlewares d'auth
// IMPORTANT : Stripe nécessite rawBody, monté séparément dans server.js
// ════════════════════════════════════════════════════════════

// POST /api/payments/mtn/webhook
router.post(
  "/mtn/webhook",
  webhookLimiter,
  ctrl.mtnWebhook
);

// POST /api/payments/orange/webhook
router.post(
  "/orange/webhook",
  webhookLimiter,
  ctrl.orangeWebhook
);

// POST /api/payments/cancel-expired (cron interne)
router.post(
  "/cancel-expired",
  ctrl.cancelExpired
);

// ════════════════════════════════════════════════════════════
// INITIATION PAIEMENTS — Routes protégées (investisseurs)
// KYC obligatoire avant tout paiement
// ════════════════════════════════════════════════════════════

// POST /api/payments/mtn/init
router.post(
  "/mtn/init",
  authenticate,
  requireKyc,
  paymentLimiter,
  validate.initMtn,
  ctrl.initMtn
);

// POST /api/payments/orange/init
router.post(
  "/orange/init",
  authenticate,
  requireKyc,
  paymentLimiter,
  validate.initOrange,
  ctrl.initOrange
);

// POST /api/payments/stripe/init
router.post(
  "/stripe/init",
  authenticate,
  requireKyc,
  paymentLimiter,
  validate.initStripe,
  ctrl.initStripe
);

// ════════════════════════════════════════════════════════════
// STATUT PAIEMENT — Polling frontend
// ════════════════════════════════════════════════════════════

// GET /api/payments/:investmentId/status
router.get(
  "/:investmentId/status",
  authenticate,
  ctrl.getStatus
);

export default router;

// ────────────────────────────────────────────────────────────
// Routes investments (montées séparément dans server.js)
// ────────────────────────────────────────────────────────────
export const investmentsRouter = (() => {
  const r = express.Router();

  // GET /api/investments — Liste des investissements de l'utilisateur
  r.get(
    "/",
    authenticate,
    ctrl.listInvestments
  );

  // GET /api/investments/:id — Détail d'un investissement
  r.get(
    "/:id",
    authenticate,
    ctrl.getInvestment
  );

  return r;
})();

// ────────────────────────────────────────────────────────────
// Routes escrow (montées séparément dans server.js sous /api/escrow)
// ────────────────────────────────────────────────────────────
export const escrowRouter = (() => {
  const r = express.Router();

  // POST /api/escrow/:investmentId/milestones — Créer un milestone
  r.post(
    "/:investmentId/milestones",
    authenticate,
    requireRole(["admin"]),
    validate.createMilestone,
    ctrl.createMilestone
  );

  // PUT /api/escrow/milestones/:milestoneId/validate — Valider un milestone
  r.put(
    "/milestones/:milestoneId/validate",
    authenticate,
    requireRole(["admin"]),
    validate.validateMilestone,
    ctrl.validateMilestone
  );

  // PUT /api/escrow/:investmentId/refund — Rembourser un investissement
  r.put(
    "/:investmentId/refund",
    authenticate,
    requireRole(["admin"]),
    validate.refundInvestment,
    ctrl.refundInvestment
  );

  return r;
})();

console.log("payments.router chargé");

// ────────────────────────────────────────────────────────────
// Routes admin investments (montées dans /api/admin)
// ────────────────────────────────────────────────────────────
export const adminInvestmentsRouter = (() => {
  const r = express.Router();

  // GET /api/admin/investments
  r.get(
    "/",
    authenticate,
    requireRole(["admin"]),
    ctrl.adminListInvestments
  );

  return r;
})();