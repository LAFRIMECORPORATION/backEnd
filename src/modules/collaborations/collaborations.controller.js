import { success } from "../../utils/response.js";
import * as svc from "./collaborations.service.js";

export async function send(req, res, next) {
  try {
    const result = await svc.sendRequest(req.user.id, req.body);
    return success(res, result, "Demande envoyée.", 201);
  } catch (err) { next(err); }
}

export async function inbox(req, res, next) {
  try {
    const result = await svc.listInbox(req.user.id);
    return success(res, result);
  } catch (err) { next(err); }
}

export async function getOne(req, res, next) {
  try {
    const result = await svc.getOne(req.params.id, req.user.id);
    return success(res, result);
  } catch (err) { next(err); }
}

export async function accept(req, res, next) {
  try {
    const result = await svc.accept(req.params.id, req.user.id);
    return success(res, result, "Demande acceptée.");
  } catch (err) { next(err); }
}

export async function decline(req, res, next) {
  try {
    const result = await svc.decline(req.params.id, req.user.id, req.body.reason);
    return success(res, result, "Demande refusée.");
  } catch (err) { next(err); }
}