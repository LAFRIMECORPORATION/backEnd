import { Server } from "socket.io";

let io;

/**
 * Initialise l'instance Socket.io avec le serveur HTTP (Renommé pour correspondre à ton server.js)
 */
export const setupSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // Permet d'éviter les blocages CORS en développement local
      methods: ["GET", "POST"],
    },
  });

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
 * Permet de récupérer l'instance io dans d'autres fichiers (ex: tes contrôleurs)
 */
export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io n'a pas encore été initialisé via setupSocketIO !");
  }
  return io;
};