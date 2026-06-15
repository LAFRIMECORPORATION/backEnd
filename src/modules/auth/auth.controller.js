// ============================================================
// LAUNCHPAD — auth/auth.controller.js
// Controllers HTTP — délèguent au service
// ============================================================

import * as authService from "./auth.service.js";
import { success, created } from "../../utils/response.js";

// ── POST /auth/register ───────────────────────────────────
export async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return created(res, result, "Compte créé avec succès. Bienvenue sur Launchpad !");
  } catch (error) {
    next(error);
  }
}

// ── POST /auth/login ──────────────────────────────────────
export async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return success(res, result, "Connexion réussie.");
  } catch (error) {
    next(error);
  }
}

// ── POST /auth/refresh-token ──────────────────────────────
export async function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);
    return success(res, result, "Token renouvelé.");
  } catch (error) {
    next(error);
  }
}

// ── POST /auth/logout ─────────────────────────────────────
export async function logout(req, res, next) {
  try {
    await authService.logout(req.user.id);
    return success(res, null, "Déconnexion réussie.");
  } catch (error) {
    next(error);
  }
}

// ── GET /auth/me ──────────────────────────────────────────
export async function getMe(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    return success(res, { user });
  } catch (error) {
    next(error);
  }
}