// ============================================================
// LAUNCHPAD — Reports Controller
// ============================================================

import * as service from "./reports.service.js";

export async function createReport(req, res) {
  const { entityType, entityId, reason, severity } = req.body;
  const reporterId = req.user.id;
  const report = await service.createReport(reporterId, { entityType, entityId, reason, severity });
  res.json(report);
}

export async function getMyReports(req, res) {
  const userId = req.user.id;
  const reports = await service.getUserReports(userId);
  res.json(reports);
}

export async function listReports(req, res) {
  const { page = 1, limit = 20, status, severity } = req.query;
  const result = await service.listReports({ page, limit, status, severity });
  res.json(result);
}

export async function getReport(req, res) {
  const { id } = req.params;
  const report = await service.getReportById(id);
  res.json(report);
}

export async function updateReportStatus(req, res) {
  const { id } = req.params;
  const { status, notes } = req.body;
  const report = await service.updateReportStatus(id, { status, notes });
  res.json(report);
}
