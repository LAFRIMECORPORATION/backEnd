import { success } from "../../utils/response.js";
import * as svc from "./feed.service.js";

export async function getFeed(req, res, next) {
  try {
    const result = await svc.getFeed(req.user.id, {
      filter: req.query.filter || "all",
      page:   parseInt(req.query.page)  || 1,
      limit:  parseInt(req.query.limit) || 20,
    });
    return success(res, result);
  } catch (err) { next(err); }
}