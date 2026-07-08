import * as svc from "./messages.service.js";
import {
  success,
  created,
  paginated,
  getPagination,
} from "../../utils/response.js";

export async function createDirectConversation(req, res, next) {
  try {
    const conv = await svc.getOrCreateDirectConversation(
      req.user.id,
      req.body.targetUserId,
    );
    return success(res, { conversation: conv });
  } catch (e) {
    next(e);
  }
}

export async function listConversations(req, res, next) {
  try {
    const conversations = await svc.listConversations(req.user.id);
    return success(res, { conversations });
  } catch (e) {
    next(e);
  }
}

export async function getMessages(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const result = await svc.getMessages(req.params.id, req.user.id, {
      page,
      limit,
    });
    return paginated(res, {
      data: result.messages,
      page,
      limit,
      total: result.total,
    });
  } catch (e) {
    next(e);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const io = req.app.get("io") || null;
    const message = await svc.sendMessage(req.user.id, req.body, io);
    return created(res, { message }, "Message envoyé.");
  } catch (e) {
    next(e);
  }
}

export async function markRead(req, res, next) {
  try {
    const io = req.app.get("io") || null;
    await svc.markAsRead(req.params.id, req.user.id, io);
    return success(res, null, "Messages marqués comme lus.");
  } catch (e) {
    next(e);
  }
}

export async function deleteMessage(req, res, next) {
  try {
    const result = await svc.deleteMessage(req.params.id, req.user.id);
    return success(res, result);
  } catch (e) {
    next(e);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const count = await svc.getTotalUnread(req.user.id);
    return success(res, { unread: count });
  } catch (e) {
    next(e);
  }
}
