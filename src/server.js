// ============================================================
// LAUNCHPAD — server.js — Version Synchronisée & Optimisée
// ============================================================

import "dotenv/config";
import { createServer } from "http";
import express    from "express";
import cors       from "cors";
import helmet     from "helmet";
import morgan     from "morgan";
import { Server } from "socket.io";

import { env }             from "./config/env.js";
import prisma, { connectDatabase } from "./config/database.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiLimiter }      from "./middleware/rateLimiter.js";
import { setupSocketIO }   from "./socket.js";

// ── Routers ───────────────────────────────────────────────
import authRouter     from "./modules/auth/auth.router.js";
import usersRouter    from "./modules/users/users.router.js";
import kycRouter      from "./modules/kyc/kyc.router.js";
import projectsRouter from "./modules/projects/projects.router.js";
import messagesRouter from "./modules/messages/messages.router.js";

const app    = express();
const server = createServer(app); // Serveur HTTP pour Express + Socket.io

// ── Socket.io ─────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: env.IS_PROD
      ? [env.FRONTEND_URL, "https://launch-pad-eosin.vercel.app"]
      : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Rendre io accessible partout (ex: req.app.get("io").emit(...))
app.set("io", io);

// Initialiser les écouteurs d'événements Real-Time
setupSocketIO(io);

// ── Configuration des CORS (Dynamique) ────────────────────
const allowedOrigins = [
  env.FRONTEND_URL,
  "https://launch-pad-eosin.vercel.app", // Ton déploiement Vercel
  "http://localhost:5173",               // Vite local
  "http://localhost:3000",               // Local alternatif
  "http://127.0.0.1:5173"                // IP locale
].filter(Boolean); // Supprime les valeurs undefined si env.FRONTEND_URL n'est pas set

app.use(cors({
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (comme Postman ou les requêtes serveurs)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`[CORS Bloqué] Origine non autorisée : ${origin}`);
      callback(new Error("Non autorisé par CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  credentials: true,
  optionsSuccessStatus: 200
}));

// ── Middlewares Globaux ───────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan(env.IS_PROD ? "combined" : "dev"));
app.use("/api", apiLimiter);

// ── Route d'accueil & Anti-Cold Start (Neon DB) ───────────
app.all("/", async (req, res) => {
  try {
    await connectDatabase(); 
    await prisma.$queryRaw`SELECT 1`; 

    res.status(200).json({ 
      status: "success",
      message: "Launchpad API and Neon Database are live, warm and running cleanly!" 
    });
  } catch (error) {
    console.error("⚠️ [Neon Cold Start] Erreur lors du réveil de la DB :", error.message);
    res.status(200).json({ 
      status: "warning",
      message: "API is live, but Database is warming up...",
      error: error.message
    });
  }
});

// ── Health Check (Détails de l'API) ───────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok", 
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(), 
    version: "1.0.0",
    phases: ["auth", "users", "kyc", "projects", "messages"],
    socketio: true,
  });
});

// ── Routes API ────────────────────────────────────────────
app.use("/api/auth",     authRouter);
app.use("/api/users",    usersRouter);
app.use("/api",          messagesRouter); // Gère /api/conversations et /api/messages

// 🛡️ Application de la double déclaration pour le module KYC (Zéro doublon)
app.use("/api/kyc",       kycRouter); // Endpoints utilisateur
app.use("/api/admin/kyc", kycRouter); // Endpoints admin

// 🚀 FIX : Application de la double déclaration pour le module Projets
app.use("/api/projects",       projectsRouter); // Endpoints utilisateur (/api/projects, /api/projects/:id)
app.use("/api/admin/projects", projectsRouter); // Endpoints admin (/api/admin/projects/pending)

// ── Gestion des Erreurs Globale ───────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Démarrage du Serveur ──────────────────────────────────
async function start() {
  try {
    await connectDatabase();
    server.listen(env.PORT, () => {
      console.log("");
      console.log("🚀 ══════════════════════════════════════");
      console.log(`   LAUNCHPAD API v1.0.0`);
      console.log(`   Env  : ${env.NODE_ENV}`);
      console.log(`   Port : ${env.PORT}`);
      console.log(`   ✅ Auth · Users · KYC · Projects · Messages`);
      console.log(`   ⚡ Socket.io activé`);
      console.log("🚀 ══════════════════════════════════════");
    });
  } catch (err) {
    console.error("❌ Démarrage échoué :", err);
    process.exit(1);
  }
}

start();

export default app;