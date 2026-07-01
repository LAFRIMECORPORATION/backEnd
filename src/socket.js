import { Server } from "socket.io";

let io;

/**
 * Initialise l'instance Socket.io directement (utilisé dans le nouveau server.js)
 */
export const initSocket = (socketIoInstance) => {
  io = socketIoInstance;

  io.on("connection", (socket) => {
    console.log(`🔌 Un client est connecté au socket : ${socket.id}`);

    socket.on("ping_server", (data) => {
      console.log("Ping reçu du frontend :", data);
      socket.emit("pong_client", { message: "Serveur synchronisé" });
    });

    socket.on("disconnect", () => {
      console.log(`❌ Client déconnecté du socket : ${socket.id}`);
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
