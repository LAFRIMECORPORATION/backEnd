// validation des variables d'environnement //
// ============================================================
// LAUNCHPAD — config/env.js
// Validation des variables d'environnement au démarrage
// L'app ne démarre pas si une variable critique est manquante
// ============================================================

import "dotenv/config";

const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error("❌ Variables d'environnement manquantes :", missing.join(", "));
  process.exit(1);
}

export const env = {
  // Serveur
  PORT:             parseInt(process.env.PORT || "3000"),
  NODE_ENV:         process.env.NODE_ENV || "development",
  FRONTEND_URL:     process.env.FRONTEND_URL || "http://localhost:5173",
  IS_PROD:          process.env.NODE_ENV === "production",

  // Base de données
  DATABASE_URL:     process.env.DATABASE_URL,

  // JWT
  JWT_SECRET:              process.env.JWT_SECRET,
  JWT_EXPIRES_IN:          process.env.JWT_EXPIRES_IN || "15m",
  JWT_REFRESH_SECRET:      process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN:  process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // Cloudinary
  CLOUDINARY_CLOUD_NAME:   process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY:      process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET:   process.env.CLOUDINARY_API_SECRET,

  // Resend
  RESEND_API_KEY:    process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "noreply@launchpad.cm",
  RESEND_FROM_NAME:  process.env.RESEND_FROM_NAME  || "Launchpad",

  // Paiements (Phase 5)
  STRIPE_SECRET_KEY:        process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET:    process.env.STRIPE_WEBHOOK_SECRET,
  MTN_MOMO_BASE_URL:        process.env.MTN_MOMO_BASE_URL,
  MTN_MOMO_SUBSCRIPTION_KEY:process.env.MTN_MOMO_SUBSCRIPTION_KEY,
  MTN_MOMO_API_KEY:         process.env.MTN_MOMO_API_KEY,
  MTN_MOMO_USER_ID:         process.env.MTN_MOMO_USER_ID,
  MTN_MOMO_ENVIRONMENT:     process.env.MTN_MOMO_ENVIRONMENT || "sandbox",
  ORANGE_MONEY_CLIENT_ID:   process.env.ORANGE_MONEY_CLIENT_ID,
  ORANGE_MONEY_CLIENT_SECRET:process.env.ORANGE_MONEY_CLIENT_SECRET,

  // IA (Phase 7)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};