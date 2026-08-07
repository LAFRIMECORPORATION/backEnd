import { success } from "../../utils/response.js";
import * as svc from "./feed.service.js";

export async function getFeed(req, res, next) {
  try {
    const result = await svc.getFeed(req.user.id, {
      filter: req.query.filter || "all",
      unreadOnly: req.query.unreadOnly === "true",
      page:   parseInt(req.query.page)  || 1,
      limit:  parseInt(req.query.limit) || 20,
    });
    return success(res, result);
  } catch (err) { next(err); }
}

export async function markEventRead(req, res, next) {
  try {
    return success(res, await svc.markEventRead(req.user.id, req.params.eventId));
  } catch (err) { next(err); }
}

export async function markAllEventsRead(req, res, next) {
  try {
    return success(res, await svc.markAllEventsRead(req.user.id));
  } catch (err) { next(err); }
}