// ============================================================
// LAUNCHPAD — badges/badges.controller.js
// ============================================================

import { success } from "../../utils/response.js";
import * as svc from "./badges.service.js";

export async function getUserBadges(req, res, next) {
  try {
    const userId = req.params.id || req.user.id;
    const result = await svc.getUserBadges(userId);
    return success(res, result);
  } catch (err) { next(err); }
}

export async function getMyBadges(req, res, next) {
  try {
    const result = await svc.getUserBadges(req.user.id);
    return success(res, result);
  } catch (err) { next(err); }
}

export async function awardBadge(req, res, next) {
  try {
    const { userId, badgeKey } = req.params;
    const result = await svc.awardBadge(userId, badgeKey);
    return success(res, result, result ? "Badge attribué." : "Badge déjà obtenu.");
  } catch (err) { next(err); }
}