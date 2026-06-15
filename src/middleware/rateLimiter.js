// protection anti-abus //
// ============================================================
// LAUNCHPAD — middleware/rateLimiter.js
// Protection contre les abus et brute-force
// ============================================================

import rateLimit from "express-rate-limit";

// ── Handler de réponse uniforme ──────────────────────────
const handler = (req, res) => {
  res.status(429).json({
    success: false,
    error:   "TOO_MANY_REQUESTS",
    message: "Trop de requêtes. Veuillez patienter quelques minutes.",
    retryAfter: res.getHeader("Retry-After"),
  });
};

// ── Routes publiques (explore, liste projets) ─────────────
// 200 requêtes par 15 minutes par IP
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  handler,
});

// ── Auth (login, register) ────────────────────────────────
// 10 tentatives par 15 minutes par IP
// Protection brute-force sur les mots de passe
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error:   "TOO_MANY_AUTH_ATTEMPTS",
    message: "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
  },
  handler,
});

// ── Upload de fichiers ────────────────────────────────────
// 20 uploads par heure par utilisateur
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  handler,
});

// ── Paiements ─────────────────────────────────────────────
// 5 tentatives par minute par utilisateur
export const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      5,
  standardHeaders: true,
  legacyHeaders:   false,
  handler,
});

// ── API générale (routes privées) ────────────────────────
// 100 requêtes par minute par IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  handler,
});