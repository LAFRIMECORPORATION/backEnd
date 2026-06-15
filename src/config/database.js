// client prisma singleton // Permet d'avoir une seule instance de PrismaClient partagée dans toute l'application//
// ============================================================
// LAUNCHPAD — config/database.js
// Client Prisma singleton — une seule instance dans toute l'app
// ============================================================

import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

const prisma = new PrismaClient({
  log: env.IS_PROD
    ? ["error"]
    : ["query", "info", "warn", "error"],
});

// Test de connexion au démarrage
export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log("✅ Base de données Neon PostgreSQL connectée");
  } catch (error) {
    console.error("❌ Impossible de se connecter à la base de données :", error.message);
    process.exit(1);
  }
}

export default prisma;