// ============================================================
// LAUNCHPAD — notifications/notifications.controller.js
// ============================================================

import { success } from "../../utils/response.js";
import * as svc from "./notifications.service.js";

export async function list(req, res, next) {
  try {
    const result = await svc.listNotifications(req.user.id, {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 30,
      unreadOnly: req.query.unreadOnly === "true",
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    const result = await svc.markAllRead(req.user.id);
    return success(
      res,
      result,
      "Toutes les notifications marquées comme lues.",
    );
  } catch (err) {
    next(err);
  }
}

export async function markOneRead(req, res, next) {
  try {
    const result = await svc.markOneRead(req.params.id, req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await svc.deleteNotification(req.params.id, req.user.id);
    return success(res, null, "Notification supprimée.");
  } catch (err) {
    next(err);
  }
}

export async function subscribePush(req, res, next) {
  try {
    const result = await svc.subscribePush(req.user.id, req.body);
    return success(res, result, "Abonné aux notifications push.");
  } catch (err) {
    next(err);
  }
}

export async function unsubscribePush(req, res, next) {
  try {
    const result = await svc.unsubscribePush(req.user.id, req.body.endpoint);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}

export async function unreadCount(req, res, next) {
  try {
    const result = await svc.getUnreadCount(req.user.id);
    return success(res, result);
  } catch (err) {
    next(err);
  }
}
