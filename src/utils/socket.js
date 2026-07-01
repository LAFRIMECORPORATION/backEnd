// ============================================================
// LAUNCHPAD — socket.js
// Gestion des événements Socket.io — Messagerie temps réel
//
// Événements côté serveur (reçoit du client) :
//   join_conversation  — Rejoindre la room d'une conversation
//   leave_conversation — Quitter la room
//   typing             — L'utilisateur est en train de taper
//   stop_typing        — Arrêt de la frappe
//
// Événements côté client (envoyés aux clients) :
//   new_message        — Nouveau message reçu
//   unread_update      — Compteur non-lus mis à jour
//   user_typing        — Indicateur de frappe
//   user_stop_typing   — Fin de l'indicateur de frappe
//   user_online        — Utilisateur connecté
//   user_offline       — Utilisateur déconnecté
// ============================================================

import jwt from "jsonwebtoken";
import { env } from "./config/env.js";

// Map des utilisateurs connectés : userId → Set<socketId>
const onlineUsers = new Map();

export function setupSocketIO(io) {

  // ── Authentification middleware Socket.io ────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token
        || socket.handshake.headers?.authorization?.split(" ")[1];

      if (!token) {
        return next(new Error("Token d'authentification manquant."));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error("Token invalide."));
    }
  });

  // ── Connexion ────────────────────────────────────────────
  io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log(`⚡ Socket connecté : user ${userId.substring(0, 8)}…`);

    // ── Rejoindre la room personnelle (notifications) ──────
    socket.join(`user_${userId}`);

    // ── Enregistrer comme en ligne ─────────────────────────
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcaster le statut en ligne à tous
    socket.broadcast.emit("user_online", { userId });

    // ── Rejoindre une conversation ─────────────────────────
    socket.on("join_conversation", ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(`conv_${conversationId}`);
      console.log(`   📬 user ${userId.substring(0,8)} rejoint conv_${conversationId.substring(0,8)}`);
    });

    // ── Quitter une conversation ───────────────────────────
    socket.on("leave_conversation", ({ conversationId }) => {
      if (!conversationId) return;
      socket.leave(`conv_${conversationId}`);
    });

    // ── Indicateur de frappe ───────────────────────────────
    socket.on("typing", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv_${conversationId}`).emit("user_typing", {
        userId,
        conversationId,
      });
    });

    socket.on("stop_typing", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv_${conversationId}`).emit("user_stop_typing", {
        userId,
        conversationId,
      });
    });

    // ── Déconnexion ───────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`⚡ Socket déconnecté : user ${userId.substring(0, 8)}…`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcaster le statut hors ligne
          socket.broadcast.emit("user_offline", { userId });
        }
      }
    });
  });
}

// ── Helper : vérifier si un utilisateur est en ligne ─────
export function isUserOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

// ── Helper : obtenir tous les utilisateurs en ligne ──────
export function getOnlineUsers() {
  return Array.from(onlineUsers.keys());
}