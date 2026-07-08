// ============================================================
// LAUNCHPAD — admin/admin.controller.js
// ============================================================

import { success } from "../../utils/response.js";
import * as svc from "./admin.service.js";

export async function getStatistics(req, res, next) {
  try {
    const result = await svc.getStatistics();
    return success(res, result);
  } catch (err) { next(err); }
}

export async function listUsers(req, res, next) {
  try {
    const result = await svc.listUsers({
      search:    req.query.search,
      role:      req.query.role,
      kycStatus: req.query.kycStatus,
      page:      parseInt(req.query.page)  || 1,
      limit:     parseInt(req.query.limit) || 20,
    });
    return success(res, result);
  } catch (err) { next(err); }
}

export async function toggleUserStatus(req, res, next) {
  try {
    const result = await svc.toggleUserStatus(req.params.id, req.user.id, req.body.reason);
    return success(res, result, result.isActive ? "Utilisateur réactivé." : "Utilisateur suspendu.");
  } catch (err) { next(err); }
}

export async function listProjects(req, res, next) {
  try {
    const result = await svc.listProjectsAdmin({
      status: req.query.status,
      page:   parseInt(req.query.page)  || 1,
      limit:  parseInt(req.query.limit) || 20,
    });
    return success(res, result);
  } catch (err) { next(err); }
}

export async function approveProject(req, res, next) {
  try {
    const result = await svc.approveProject(req.params.id, req.user.id, req.body.notes);
    return success(res, result, "Projet approuvé.");
  } catch (err) { next(err); }
}

export async function rejectProject(req, res, next) {
  try {
    const result = await svc.rejectProject(req.params.id, req.user.id, req.body.reason);
    return success(res, result, "Projet rejeté.");
  } catch (err) { next(err); }
}

export async function getAuditLogs(req, res, next) {
  try {
    const result = await svc.getAuditLogs({
      page:   parseInt(req.query.page)  || 1,
      limit:  parseInt(req.query.limit) || 50,
      action: req.query.action,
    });
    return success(res, result);
  } catch (err) { next(err); }
}