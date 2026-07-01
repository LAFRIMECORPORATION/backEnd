// ============================================================
// LAUNCHPAD — src/server.js
// Serveur Express principal — Phase 0 → Phase 5
// ============================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";

import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { initSocket } from "./socket.js";
import { startCronJobs } from "./cron.js";

// ── Routers ──────────────────────────────────────────────────
import authRouter from "./modules/auth/auth.router.js";
import usersRouter from "./modules/users/users.router.js";
import kycRouter from "./modules/kyc/kyc.router.js";
import projectsRouter from "./modules/projects/projects.router.js";
import messagesRouter from "./modules/messages/messages.router.js";

import paymentsRouter, {
  investmentsRouter,
  escrowRouter,
  adminInvestmentsRouter,
} from "./modules/payments/payments.router.js";

const allowedOrigins = [
  env.FRONTEND_URL,
  env.FRONTEND_URL?.endsWith("/") ? env.FRONTEND_URL.slice(0, -1) : `${env.FRONTEND_URL}/`,
  "https://launch-pad-eosin.vercel.app",
  "https://launch-pad-eosin.vercel.app/",
  "http://localhost:5173",
  "http://localhost:5173/",
  "http://localhost:3000",
  "http://localhost:3000/",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5173/"
].filter(Boolean);

// ── App & HTTP Server ─────────────────────────────────────────
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Partager l'instance io avec Express pour les contrôleurs
app.set("io", io);

// ════════════════════════════════════════════════════════════
// MIDDLEWARES GLOBAUX
// ════════════════════════════════════════════════════════════

// Sécurité HTTP
app.use(helmet());

// CORS dynamique
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS non autorisé pour l'origine : ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "stripe-signature", "X-Requested-With", "Accept"],
}));

// Rate limiting global
app.use(globalLimiter);

// ── WEBHOOK STRIPE — doit être AVANT express.json() ──────────
// Stripe requiert le corps brut (Buffer) pour vérifier la signature
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, _res, next) => {
    req.rawBody = req.body;   // Stocker le Buffer brut
    next();
  },
  (await import("./modules/payments/payments.controller.js")).stripeWebhook
);

// ── Corps JSON pour toutes les autres routes ─────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Launchpad API is alive",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    phases: "Auth · Users · KYC · Projects · Messages · Payments",
    version: "1.5.0",
  });
});

function startSelfPing() {
  const enabled = process.env.ENABLE_SELF_PING !== "false";
  if (!enabled) return;

  const url = process.env.HEALTH_URL || `http://localhost:${PORT}/health`;
  const intervalMs = 4 * 60 * 1000; // toutes les 4 minutes

  setInterval(async () => {
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        console.warn(`Self-ping échoué : ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.warn("Self-ping Health failed:", err?.message || err);
    }
  }, intervalMs);
}

// ════════════════════════════════════════════════════════════
// ROUTES API
// ════════════════════════════════════════════════════════════

// Auth
app.use("/api/auth", authRouter);

// Users & Profils
app.use("/api/users", usersRouter);

// KYC
app.use("/api/kyc", kycRouter);

// Projects
app.use("/api/projects", projectsRouter);

// Messages & Conversations
app.use("/api", messagesRouter);  // Monte /conversations + /messages

// ── Paiements ────────────────────────────────────────────────
app.use("/api/payments", paymentsRouter);      // MTN · Orange · Stripe · status
app.use("/api/investments", investmentsRouter);   // Liste + détail investissements
app.use("/api/escrow", escrowRouter);        // Milestones + remboursements

// ── Admin ────────────────────────────────────────────────────
app.use("/api/admin/investments", adminInvestmentsRouter);
// Les autres routes admin (KYC, projets, stats) sont dans leurs modules respectifs

// ════════════════════════════════════════════════════════════
// ROUTE 404
// ════════════════════════════════════════════════════════════
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: "Cette route n'existe pas.",
  });
});

// ════════════════════════════════════════════════════════════
// HANDLER D'ERREURS GLOBAL (doit être en dernier)
// ════════════════════════════════════════════════════════════
app.use(errorHandler);

// ════════════════════════════════════════════════════════════
// SOCKET.IO
// ════════════════════════════════════════════════════════════
initSocket(io);

// ════════════════════════════════════════════════════════════
// DÉMARRAGE
// ════════════════════════════════════════════════════════════
const PORT = env.PORT || 3000;

async function start() {
  try {
    // Garantir la connexion à la base de données
    await connectDatabase();

    // Lancement du serveur
    server.listen(PORT, () => {
      console.log(`\n🚀 Launchpad API démarrée sur le port ${PORT}`);
      console.log(`📡 Health : http://localhost:${PORT}/health`);
      console.log(`⚡ Socket.io : actif`);
      console.log(`🔑 Phases actives : Auth · Users · KYC · Projects · Messages · Payments\n`);

      // Démarrer les cron jobs
      startCronJobs();

      // Auto ping pour maintenir le serveur éveillé
      startSelfPing();
    });
  } catch (err) {
    console.error("❌ Démarrage échoué :", err);
    process.exit(1);
  }
}

start();

export { app, server, io };