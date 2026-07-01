// ============================================================
// LAUNCHPAD — payments/payments.controller.js
// Controllers HTTP pour les paiements et les investissements
// ============================================================

import * as paymentsService from "./payments.service.js";
import { success, created, paginated, getPagination } from "../../utils/response.js";
import { AppError } from "../../middleware/errorHandler.js";

export async function mtnWebhook(req, res, next) {
  try {
    const result = await paymentsService.handleMtnWebhook(req.body, req.headers);
    return success(res, result, "Webhook MTN traité.");
  } catch (error) {
    next(error);
  }
}

export async function orangeWebhook(req, res, next) {
  try {
    const result = await paymentsService.handleOrangeWebhook(req.body);
    return success(res, result, "Webhook Orange traité.");
  } catch (error) {
    next(error);
  }
}

export async function stripeWebhook(req, res, next) {
  try {
    const signature = req.headers["stripe-signature"];
    const result = await paymentsService.handleStripeWebhook(req.rawBody, signature);
    return success(res, result, "Webhook Stripe traité.");
  } catch (error) {
    next(error);
  }
}

export async function cancelExpired(req, res, next) {
  try {
    const result = await paymentsService.cancelExpiredPayments();
    return success(res, result, "Paiements expirés annulés.");
  } catch (error) {
    next(error);
  }
}

export async function initMtn(req, res, next) {
  try {
    const result = await paymentsService.initMtnPayment(req.user.id, req.body);
    return created(res, result, "Initialisation du paiement MTN réussie.");
  } catch (error) {
    next(error);
  }
}

export async function initOrange(req, res, next) {
  try {
    const result = await paymentsService.initOrangePayment(req.user.id, req.body);
    return created(res, result, "Initialisation du paiement Orange réussie.");
  } catch (error) {
    next(error);
  }
}

export async function initStripe(req, res, next) {
  try {
    const result = await paymentsService.initStripePayment(req.user.id, req.body);
    return created(res, result, "Initialisation du paiement Stripe réussie.");
  } catch (error) {
    next(error);
  }
}

export async function getStatus(req, res, next) {
  try {
    const result = await paymentsService.getPaymentStatus(req.params.investmentId, req.user.id);
    return success(res, result);
  } catch (error) {
    next(error);
  }
}

export async function listInvestments(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const result = await paymentsService.listInvestments(req.user.id, { page, limit });
    return paginated(res, { data: result.investments, page, limit, total: result.total });
  } catch (error) {
    next(error);
  }
}

export async function getInvestment(req, res, next) {
  try {
    const result = await paymentsService.getInvestment(req.user.id, req.params.id);
    return success(res, { investment: result });
  } catch (error) {
    next(error);
  }
}

export async function createMilestone(req, res, next) {
  try {
    const result = await paymentsService.createMilestone(req.params.investmentId, req.body, req.user.id);
    return created(res, result, "Milestone créé.");
  } catch (error) {
    next(error);
  }
}

export async function validateMilestone(req, res, next) {
  try {
    const result = await paymentsService.validateMilestone(req.params.milestoneId, req.user.id, req.body.notes);
    return success(res, result, "Milestone validé.");
  } catch (error) {
    next(error);
  }
}

export async function refundInvestment(req, res, next) {
  try {
    const result = await paymentsService.refundInvestment(req.params.investmentId, req.user.id, req.body.reason);
    return success(res, result, "Investissement remboursé.");
  } catch (error) {
    next(error);
  }
}

export async function adminListInvestments(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const { status } = req.query;
    const result = await paymentsService.adminListInvestments({ page, limit, status });
    return paginated(res, { data: result.investments, page, limit, total: result.total });
  } catch (error) {
    next(error);
  }
}
