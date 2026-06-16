// ============================================================
// LAUNCHPAD — server.js  Phase 4 — avec Socket.io
// ============================================================

import "dotenv/config";
import { createServer } from "http";
import express    from "express";
import cors       from "cors";
import helmet     from "helmet";
import morgan     from "morgan";
import { Server } from "socket.io";

import { env }             from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiLimiter }      from "./middleware/rateLimiter.js";
import { setupSocketIO }   from "./socket.js";

// ── Routers ───────────────────────────────────────────────
import authRouter     from "./modules/auth/auth.router.js";
import usersRouter    from "./modules/users/users.router.js";
import kycRouter      from "./modules/kyc/kyc.router.js";
import projectsRouter from "./modules/projects/projects.router.js";
import messagesRouter from "./modules/messages/messages.router.js";

// ── Initialisation de l'application ───────────────────────
const app    = express();
const server = createServer(app);  // HTTP server pour Socket.io

// ── Socket.io ─────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: env.IS_PROD
      ? [env.FRONTEND_URL]
      : ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET","POST"],
    credentials: true,
  },
  transports: ["websocket","polling"],
});

// Rendre io accessible dans les routes (req.app.get("io"))
app.set("io", io);

// Configurer les événements Socket.io
setupSocketIO(io);

// ── Middleware Globaux ────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy:{ policy:"cross-origin" } }));

// ── Configuration CORS ────────────────────────────────────
const allowedOrigins = [
  "https://launch-pad-eosin.vercel.app",        // Ton Frontend Vercel Production
  "http://localhost:5173",                      // Vite Local
  "http://localhost:3000",                      // Local alternatif
  "http://127.0.0.1:5173"                       // IP locale
];

app.use(cors({
  origin: function (origin, callback) {
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

app.use(express.json({ limit:"10mb" }));
app.use(express.urlencoded({ extended:true, limit:"10mb" }));
app.use(morgan(env.IS_PROD ? "combined" : "dev"));
app.use("/api", apiLimiter);

// ── Health (Route détaillée) ──────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({
    status:"ok", environment:env.NODE_ENV,
    timestamp:new Date().toISOString(), version:"1.0.0",
    phases:["auth","users","kyc","projects","messages"],
    socketio:true,
  });
});

// ── Routes API ────────────────────────────────────────────
app.use("/api/auth",     authRouter);
app.use("/api/users",    usersRouter);
app.use("/api/kyc",      kycRouter);
app.use("/api/projects", projectsRouter);
app.use("/api",          messagesRouter);  // /api/conversations + /api/messages

// ── Route d'accueil et de Health Check pour UptimeRobot ──
// 🎯 PARFAIT ICI : Après les routes, mais AVANT le notFoundHandler !
app.all("/", (req, res) => {
  res.status(200).json({ 
    status: "success",
    message: "Launchpad API is live and running cleanly!" 
  });
});

// ── Gestion des Erreurs ───────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Démarrage ─────────────────────────────────────────────
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