import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "./config/env.js";

let io;
const onlineUsers = new Map();

function setUserOnline(userId, socketId) {
  const sockets = onlineUsers.get(userId) || new Set();
  sockets.add(socketId);
  onlineUsers.set(userId, sockets);
}

function setUserOffline(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
}

function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

/**
 * Initialise l'instance Socket.io directement (utilisé dans le nouveau server.js)
 */
export const initSocket = (socketIoInstance) => {
  io = socketIoInstance;

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Token socket manquant."));
      }
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.data.user = {
        id: decoded.userId,
        role: decoded.role,
      };
      next();
    } catch {
      next(new Error("Authentification socket invalide."));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.user?.id;
    console.log(`🔌 Un client est connecté au socket : ${socket.id}`);

    if (userId) {
      setUserOnline(userId, socket.id);
      socket.join(`user_${userId}`);
      socket.emit("presence_state", { userId, online: true });
    }

    socket.on("ping_server", (data) => {
      console.log("Ping reçu du frontend :", data);
      socket.emit("pong_client", { message: "Serveur synchronisé" });
    });

    socket.on("join_conversation", ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(`conv_${conversationId}`);
      socket.to(`conv_${conversationId}`).emit("user_online", {
        conversationId,
        userId,
        online: true,
      });
    });

    socket.on("leave_conversation", ({ conversationId }) => {
      if (!conversationId) return;
      socket.leave(`conv_${conversationId}`);
      socket.to(`conv_${conversationId}`).emit("user_online", {
        conversationId,
        userId,
        online: false,
      });
    });

    socket.on("typing", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv_${conversationId}`).emit("user_typing", {
        conversationId,
        userId,
      });
    });

    socket.on("stop_typing", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv_${conversationId}`).emit("user_stop_typing", {
        conversationId,
        userId,
      });
    });

    socket.on("conversation_read", ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conv_${conversationId}`).emit("messages_read", {
        conversationId,
        userId,
        readAt: new Date().toISOString(),
      });
    });

    socket.on("presence_check", ({ userId: targetUserId }) => {
      if (!targetUserId) return;
      socket.emit("presence_state", {
        userId: targetUserId,
        online: isUserOnline(targetUserId),
      });
    });

    socket.on("disconnect", () => {
      console.log(`❌ Client déconnecté du socket : ${socket.id}`);
      if (userId) {
        const isNowFullyOffline = setUserOffline(userId, socket.id);
        if (isNowFullyOffline) {
          io.emit("user_online", {
            userId,
            online: false,
          });
        }
      }
    });
  });

  return io;
};

/**
 * Initialise l'instance Socket.io avec le serveur HTTP (Reste pour compatibilité)
 */
export const setupSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  return initSocket(io);
};

/**
 * Permet de récupérer l'instance io dans d'autres fichiers (ex: tes contrôleurs)
 */
export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io n'a pas encore été initialisé !");
  }
  return io;
};
