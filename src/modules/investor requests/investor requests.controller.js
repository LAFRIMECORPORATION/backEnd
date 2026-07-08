import { success } from "../../utils/response.js";
import * as svc from "./investor requests.service.js";

export async function create(req, res, next) {
  try {
    const result = await svc.createRequest(req.user.id, req.body);
    return success(res, result, "Offre publiée.", 201);
  } catch (err) { next(err); }
}

export async function list(req, res, next) {
  try {
    const result = await svc.listRequests({
      type:   req.query.type,
      sector: req.query.sector,
      search: req.query.search,
      page:   parseInt(req.query.page)  || 1,
      limit:  parseInt(req.query.limit) || 20,
    });
    return success(res, result);
  } catch (err) { next(err); }
}

export async function getOne(req, res, next) {
  try {
    const result = await svc.getRequest(req.params.id);
    return success(res, result);
  } catch (err) { next(err); }
}

export async function apply(req, res, next) {
  try {
    const result = await svc.applyToRequest(req.params.id, req.user.id, req.body);
    return success(res, result, "Candidature envoyée.", 201);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const result = await svc.updateRequest(req.params.id, req.user.id, req.body);
    return success(res, result, "Offre mise à jour.");
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    await svc.deleteRequest(req.params.id, req.user.id);
    return success(res, null, "Offre supprimée.");
  } catch (err) { next(err); }
}

export async function mine(req, res, next) {
  try {
    const result = await svc.myRequests(req.user.id);
    return success(res, result);
  } catch (err) { next(err); }
}