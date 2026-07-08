// ============================================================
// LAUNCHPAD — due-diligence/due-diligence.controller.js
// ============================================================

import { success } from "../../utils/response.js";
import * as svc from "./due diligence.service.js";

export async function analyze(req, res, next) {
  try {
    const { projectId } = req.body;
    if (!projectId) return next(new Error("projectId requis."));
    const result = await svc.analyzeProject(projectId, req.user.id);
    return success(res, result, result.fromCache ? "Rapport récupéré depuis le cache." : "Analyse IA générée avec succès.", 201);
  } catch (err) { next(err); }
}

export async function getReport(req, res, next) {
  try {
    const result = await svc.getReport(req.params.projectId);
    return success(res, result);
  } catch (err) { next(err); }
}