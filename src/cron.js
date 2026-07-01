// ============================================================
// LAUNCHPAD — src/cron.js
// Jobs planifiés (polling paiements expirés, stats, etc.)
//
// Utilise node-cron (léger, pas de dépendance externe lourde)
// Lancé depuis server.js au démarrage
// ============================================================

import cron from "node-cron";
import { cancelExpiredPayments } from "./modules/payments/payments.service.js";

// ────────────────────────────────────────────────────────────
// JOB 1 — Annuler les paiements expirés
// Fréquence : toutes les 5 minutes
// Rationale : Les paiements MTN/Orange expirent après 10 min
//             sans confirmation. Ce job les marque "failed"
//             et notifie l'investisseur.
// ────────────────────────────────────────────────────────────
export function startCronJobs() {
  // Toutes les 5 minutes : annuler les paiements expirés
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await cancelExpiredPayments();
      if (result.cancelledCount > 0) {
        console.log(`[CRON] ${new Date().toISOString()} — ${result.cancelledCount} paiement(s) expiré(s) annulé(s)`);
      }
    } catch (err) {
      console.error("[CRON] Erreur annulation paiements expirés :", err.message);
    }
  });

  // Toutes les heures : log de santé DB (optionnel, peut être retiré)
  cron.schedule("0 * * * *", () => {
    console.log(`[CRON] ${new Date().toISOString()} — Heartbeat OK`);
  });

  console.log("⏰ Cron jobs démarrés (paiements expirés : toutes les 5 min)");
}
