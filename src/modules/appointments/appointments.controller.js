// ============================================================
// LAUNCHPAD — appointments/appointments.controller.js
// ============================================================

import { success } from "../../utils/response.js";
import * as svc from "./appointments.service..js";

export async function create(req, res, next) {
  try {
    const result = await svc.createAppointment(req.user.id, req.body);
    return success(res, result, "Demande de rendez-vous envoyée.", 201);
  } catch (err) { next(err); }
}

export async function list(req, res, next) {
  try {
    const result = await svc.listAppointments(req.user.id, {
      tab:   req.query.tab   || "upcoming",
      page:  parseInt(req.query.page)  || 1,
      limit: parseInt(req.query.limit) || 20,
    });
    return success(res, result);
  } catch (err) { next(err); }
}

export async function getOne(req, res, next) {
  try {
    const result = await svc.getAppointment(req.params.id, req.user.id);
    return success(res, result);
  } catch (err) { next(err); }
}

export async function confirm(req, res, next) {
  try {
    const result = await svc.confirmAppointment(req.params.id, req.user.id);
    return success(res, result, "Rendez-vous confirmé.");
  } catch (err) { next(err); }
}

export async function cancel(req, res, next) {
  try {
    const result = await svc.cancelAppointment(req.params.id, req.user.id, req.body.reason);
    return success(res, result, "Rendez-vous annulé.");
  } catch (err) { next(err); }
}

export async function complete(req, res, next) {
  try {
    const result = await svc.completeAppointment(req.params.id, req.user.id);
    return success(res, result, "Rendez-vous marqué comme terminé.");
  } catch (err) { next(err); }
}

export async function availability(req, res, next) {
  try {
    const result = await svc.getAvailability(req.params.userId, {
      date: req.query.date || new Date().toISOString().split("T")[0],
    });
    return success(res, result);
  } catch (err) { next(err); }
}