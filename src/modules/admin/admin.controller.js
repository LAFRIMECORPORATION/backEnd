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
      adminId: req.query.adminId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    return success(res, result);
  } catch (err) { next(err); }
}

export async function deleteUser(req, res, next) {
  try {
    const result = await svc.deleteUser(req.params.id, req.user.id, req.body?.reason);
    return success(res, result, "Utilisateur supprimé de la plateforme.");
  } catch (err) { next(err); }
}

export async function deleteProject(req, res, next) {
  try {
    const result = await svc.deleteProject(req.params.id, req.user.id, req.body?.reason);
    return success(res, result, "Projet retiré de la plateforme.");
  } catch (err) { next(err); }
}

export async function getMarketplaceOverview(req, res, next) {
  try {
    return success(res, await svc.getMarketplaceOverview());
  } catch (err) { next(err); }
}

export async function updateMarketplaceApplication(req, res, next) {
  try {
    const result = await svc.updateMarketplaceApplication(
      req.params.id,
      req.user.id,
      req.body.status,
    );
    return success(res, result, "Candidature mise à jour.");
  } catch (err) { next(err); }
}

export async function deleteMarketplaceOffer(req, res, next) {
  try {
    const result = await svc.deleteMarketplaceOffer(
      req.params.id,
      req.user.id,
      req.body?.reason,
    );
    return success(res, result, "Offre supprimée par l'administration.");
  } catch (err) { next(err); }
}

export async function getInvestmentsControl(req, res, next) {
  try { return success(res, await svc.getInvestmentsControl(req.query)); }
  catch (err) { next(err); }
}

export async function refundInvestment(req, res, next) {
  try {
    return success(res, await svc.refundInvestment(req.params.id, req.user.id, req.body?.reason), "Investissement remboursé.");
  } catch (err) { next(err); }
}

export async function getAcademyControl(req, res, next) {
  try { return success(res, await svc.getAcademyControl()); }
  catch (err) { next(err); }
}

export async function deleteAcademyCourse(req, res, next) {
  try { return success(res, await svc.deleteAcademyCourse(req.params.id, req.user.id), "Cours supprimé."); }
  catch (err) { next(err); }
}

export async function getForumControl(req, res, next) {
  try { return success(res, await svc.getForumControl()); }
  catch (err) { next(err); }
}

export async function toggleForumPin(req, res, next) {
  try { return success(res, await svc.toggleForumPin(req.params.id, req.user.id)); }
  catch (err) { next(err); }
}

export async function deleteForumPost(req, res, next) {
  try { return success(res, await svc.deleteForumPost(req.params.id, req.user.id), "Publication forum supprimée."); }
  catch (err) { next(err); }
}