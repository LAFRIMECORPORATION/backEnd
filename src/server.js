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
import messagesRouter from "./modules/messages/messages.router.js";  // 🆕

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

// ── Middleware ────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy:{ policy:"cross-origin" } }));
app.use(cors({
  origin: env.IS_PROD
    ? [env.FRONTEND_URL]
    : ["http://localhost:5173","http://localhost:3000","http://127.0.0.1:5173"],
  methods:["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders:["Content-Type","Authorization","X-Requested-With","Accept"], // 👈 Plus robuste
  credentials:true,
}));
app.use(express.json({ limit:"10mb" }));
app.use(express.urlencoded({ extended:true, limit:"10mb" }));
app.use(morgan(env.IS_PROD ? "combined" : "dev"));
app.use("/api", apiLimiter);

// ── Health ────────────────────────────────────────────────
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

// Phase 5+
// app.use("/api/payments",       paymentsRouter);
// app.use("/api/investments",    investmentsRouter);
// app.use("/api/forum",          forumRouter);
// app.use("/api/appointments",   appointmentsRouter);
// app.use("/api/notifications",  notificationsRouter);
// app.use("/api/feed",           feedRouter);
// app.use("/api/admin",          adminRouter);

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