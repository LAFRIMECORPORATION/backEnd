// ============================================================
// LAUNCHPAD — kyc/kyc.controller.js
// Controllers HTTP du module KYC
// ============================================================

import * as kycService from "./kyc.service.js";
import { success, created, paginated, getPagination } from "../../utils/response.js";
import { AppError } from "../../middleware/errorHandler.js";

// ── POST /api/kyc/submit ─────────────────────────────────
export async function submitKyc(req, res, next) {
  try {
    // Les fichiers sont dans req.files (multer multifield)
    // req.files = { cni_file: [{buffer,mimetype}], selfie: [...], ... }
    if (!req.files || Object.keys(req.files).length === 0) {
      throw new AppError("Aucun document fourni.", 400, "NO_FILES");
    }

    // Convertir multer files en buffers simples
    const files = {};
    for (const [fieldName, fileArray] of Object.entries(req.files)) {
      files[fieldName] = fileArray[0].buffer;
    }

    const result = await kycService.submitKyc(
      req.user.id,
      req.body,
      files
    );

    return success(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

// ── GET /api/kyc/status ───────────────────────────────────
export async function getKycStatus(req, res, next) {
  try {
    const status = await kycService.getKycStatus(req.user.id);
    return success(res, status);
  } catch (error) {
    next(error);
  }
}

// ── [ADMIN] GET /api/admin/kyc/pending ───────────────────
export async function listPendingKyc(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const { role, search } = req.query;
    const { users, total } = await kycService.listPendingKyc({
      page, limit, role, search,
    });
    return paginated(res, { data: users, page, limit, total });
  } catch (error) {
    next(error);
  }
}

// ── [ADMIN] GET /api/admin/kyc/:userId ───────────────────
export async function getKycDetail(req, res, next) {
  try {
    const detail = await kycService.getKycDetail(req.params.userId);
    return success(res, detail);
  } catch (error) {
    next(error);
  }
}

// ── [ADMIN] PUT /api/admin/kyc/:userId/approve ───────────
export async function approveKyc(req, res, next) {
  try {
    const result = await kycService.approveKyc(
      req.params.userId,
      req.user.id
    );
    return success(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

// ── [ADMIN] PUT /api/admin/kyc/:userId/reject ────────────
export async function rejectKyc(req, res, next) {
  try {
    const result = await kycService.rejectKyc(
      req.params.userId,
      req.user.id,
      req.body.reason
    );
    return success(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

// ── [ADMIN] POST /api/admin/kyc/:userId/request-docs ─────
export async function requestMoreDocs(req, res, next) {
  try {
    const result = await kycService.requestMoreDocs(
      req.params.userId,
      req.user.id,
      req.body
    );
    return success(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

// ── [ADMIN] GET /api/admin/kyc/stats ─────────────────────
export async function getKycStats(req, res, next) {
  try {
    const stats = await kycService.getKycStats();
    return success(res, stats);
  } catch (error) {
    next(error);
  }
}