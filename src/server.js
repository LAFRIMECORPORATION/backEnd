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
import { connectDatabase, pingDatabase } from "./config/database.js";
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

import forumRouter from "./modules/forum/forum.router.js";
import notificationsRouter from "./modules/notifications/notification.router.js";
import badgesRouter from "./modules/badges/badges.router.js";
import appointmentsRouter from "./modules/appointments/appointments.router.js";
import collaborationsRouter from "./modules/collaborations/collaborations.router.js";
import feedRouter from "./modules/feed/feed.router.js";
import adminRouter from "./modules/admin/admin.router.js";
import dueDiligenceRouter from "./modules/due diligence/due diligence.router.js";
import investorRequestsRouter from "./modules/investor requests/investor requests.router.js";
import academyRouter from "./modules/academy/academy.router.js";
import reportsRouter from "./modules/reports/reports.router.js";
import pushRouter from "./modules/push/push.router.js";

const allowedOrigins = [
  env.FRONTEND_URL,
  env.FRONTEND_URL?.endsWith("/")
    ? env.FRONTEND_URL.slice(0, -1)
    : `${env.FRONTEND_URL}/`,
  "https://launch-pad-eosin.vercel.app",
  "https://launch-pad-eosin.vercel.app/",
  "http://localhost:5173",
  "http://localhost:5173/",
  "http://localhost:3000",
  "http://localhost:3000/",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5173/",
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
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS non autorisé pour l'origine : ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "stripe-signature",
      "X-Requested-With",
      "Accept",
    ],
  }),
);

// Rate limiting global
app.use(globalLimiter);

// ── Logging des requêtes HTTP ───────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;
  const timestamp = new Date().toISOString();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const color = statusCode >= 400 ? '\x1b[31m' : statusCode >= 300 ? '\x1b[33m' : '\x1b[32m';
    const reset = '\x1b[0m';
    console.log(`${color}[${timestamp}]${reset} ${method} ${originalUrl} ${color}${statusCode}${reset} ${duration}ms - ${ip}`);
  });

  next();
});

// ── WEBHOOK STRIPE — doit être AVANT express.json() ──────────
// Stripe requiert le corps brut (Buffer) pour vérifier la signature
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, _res, next) => {
    req.rawBody = req.body; // Stocker le Buffer brut
    next();
  },
  (await import("./modules/payments/payments.controller.js")).stripeWebhook,
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
    version: "2.1.0",
    modules: [
      "Auth",
      "Users",
      "KYC",
      "Projects",
      "Messages",
      "Payments",
      "Forum",
      "Notifications",
      "Badges",
      "Appointments",
      "Collaborations",
      "Feed",
      "Admin",
      "DueDiligence",
      "InvestorRequests",
      "Academy",
      "Reports",
      "Push",
    ],
  });
});

function startSelfPing() {
  const enabled = process.env.ENABLE_SELF_PING !== "false";
  if (!enabled) return;

  const url = process.env.HEALTH_URL || `http://localhost:${PORT}/health`;
  const intervalMs = 4 * 60 * 1000;

  setInterval(async () => {
    try {
      await pingDatabase();
    } catch (err) {
      console.warn("Self-ping DB failed:", err?.message || err);
    }

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
app.use("/api/admin/kyc", kycRouter);

// Projects
app.use("/api/projects", projectsRouter);
app.use("/api/admin/projects", projectsRouter);

// Messages & Conversations
app.use("/api", messagesRouter); // Monte /conversations + /messages

// ── Paiements ────────────────────────────────────────────────
app.use("/api/payments", paymentsRouter); // MTN · Orange · Stripe · status
app.use("/api/investments", investmentsRouter); // Liste + détail investissements
app.use("/api/escrow", escrowRouter); // Milestones + remboursements

// ── Admin ────────────────────────────────────────────────────
app.use("/api/admin/investments", adminInvestmentsRouter);
// Les autres routes admin (KYC, projets, stats) sont dans leurs modules respectifs

// ── Phase 6 ───────────────────────────────────────────────────
app.use("/api/forum", forumRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/badges", badgesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/collaborations", collaborationsRouter);
app.use("/api/feed", feedRouter);
app.use("/api/due-diligence", dueDiligenceRouter);
app.use("/api/investor-requests", investorRequestsRouter);
app.use("/api/academy", academyRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/push", pushRouter);
app.use("/api/admin", adminRouter);

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
const PORT = env.PORT || 3001;

async function start() {
  try {
    // Garantir la connexion à la base de données
    await connectDatabase();

    // Lancement du serveur
    server.listen(PORT, () => {
      console.log(`\n🚀 Launchpad API démarrée sur le port ${PORT}`);
      console.log(`📡 Health : http://localhost:${PORT}/health`);
      console.log(`⚡ Socket.io : actif`);
      console.log(
        `🔑 Phases actives : Auth · Users · KYC · Projects · Messages · Payments · Forum · Notifications · Badges · Appointments · Collaborations · Feed · DueDiligence · InvestorRequests · Admin\n`,
      );

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
