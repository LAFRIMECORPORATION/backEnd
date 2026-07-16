// ============================================================
// LAUNCHPAD — src/cron.js
// Jobs planifiés (polling paiements expirés, stats, etc.)
//
// Utilise node-cron (léger, pas de dépendance externe lourde)
// Lancé depuis server.js au démarrage
// ============================================================

import cron from "node-cron";
import prisma from "./config/database.js";
import { cancelExpiredPayments } from "./modules/payments/payments.service.js";
import { pingDatabase } from "./config/database.js";
import { createNotification } from "./modules/notifications/notifications.service.js";
import { generateAndStoreEmbedding } from "./modules/projects/Similarity.service.js";
import { checkAndAwardBadges } from "./modules/badges/badges.service.js";

// ────────────────────────────────────────────────────────────
// JOB 1 — Annuler les paiements expirés
// Fréquence : toutes les 5 minutes
// Rationale : Les paiements MTN/Orange expirent après 10 min
//             sans confirmation.
// ────────────────────────────────────────────────────────────
export function startCronJobs() {
  console.log("⏰ Cron jobs désactivés (mis en commentaire) pour économiser les tokens Neon.");
  console.log("   Pour réactiver une tâche, décommentez-la dans src/cron.js");

  /*
  // Toutes les 5 minutes : annuler les paiements expirés
  cron.schedule("*/5 * * * *", async () => {
    try {
      const result = await cancelExpiredPayments();
      if (result.cancelledCount > 0) {
        console.log(
          `[CRON] ${new Date().toISOString()} — ${result.cancelledCount} paiement(s) expiré(s) annulé(s)`,
        );
      }
    } catch (err) {
      console.error(
        "[CRON] Erreur annulation paiements expirés :",
        err.message,
      );
    }
  });
  */

  /*
  // Toutes les heures : rappels RDV (J-1 et H-1)
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      const in55m = new Date(now.getTime() + 55 * 60 * 1000);
      const in65m = new Date(now.getTime() + 65 * 60 * 1000);

      const appointmentsToRemind = await prisma.appointment.findMany({
        where: {
          status: "confirmed",
          reminderSent: false,
          OR: [
            { scheduledAt: { gte: in23h, lte: in25h } },
            { scheduledAt: { gte: in55m, lte: in65m } },
          ],
        },
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          meetingUrl: true,
          organizerId: true,
          participantId: true,
        },
      });

      for (const appt of appointmentsToRemind) {
        const isH1 = appt.scheduledAt >= in55m && appt.scheduledAt <= in65m;
        const label = isH1 ? "dans 1 heure" : "demain";

        for (const userId of [appt.organizerId, appt.participantId]) {
          await createNotification({
            userId,
            type: "appointment",
            title: `⏰ Rappel : rendez-vous ${label}`,
            body: `"${appt.title}" ${label}.${appt.meetingUrl ? ` Lien : ${appt.meetingUrl}` : ""}`,
            actionUrl: "/appointments",
          }).catch(console.error);
        }

        await prisma.appointment
          .update({
            where: { id: appt.id },
            data: { reminderSent: true },
          })
          .catch(console.error);
      }

      if (appointmentsToRemind.length > 0) {
        console.log(
          `[CRON] ${appointmentsToRemind.length} rappel(s) RDV envoyé(s)`,
        );
      }
    } catch (err) {
      console.error("[CRON] Erreur rappels RDV :", err.message);
    }
  });
  */

  /*
  // Tous les jours à minuit : marquer RDV passés comme terminés
  cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();
      const appointments = await prisma.appointment.findMany({
        where: {
          status: "confirmed",
          scheduledAt: { lt: now },
        },
        select: { id: true, scheduledAt: true, durationMin: true },
      });

      const completedIds = appointments
        .filter((appt) => {
          const endDate = new Date(
            appt.scheduledAt.getTime() + appt.durationMin * 60 * 1000,
          );
          return endDate < now;
        })
        .map((appt) => appt.id);

      if (completedIds.length > 0) {
        const result = await prisma.appointment.updateMany({
          where: { id: { in: completedIds } },
          data: { status: "completed" },
        });
        console.log(
          `[CRON] ${result.count} rendez-vous marqué(s) comme terminés`,
        );
      }
    } catch (err) {
      console.error("[CRON] Erreur auto-complete RDV :", err.message);
    }
  });
  */

  /*
  // Tous les jours à 2h : générer les embeddings manquants
  cron.schedule("0 2 * * *", async () => {
    try {
      const projects = await prisma.project.findMany({
        where: { status: "active", aiEmbedding: null },
        select: { id: true },
        take: 20,
      });

      for (const project of projects) {
        await generateAndStoreEmbedding(project.id).catch(console.error);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (projects.length > 0) {
        console.log(`[CRON] ${projects.length} embedding(s) IA généré(s)`);
      }
    } catch (err) {
      console.error("[CRON] Embeddings IA :", err.message);
    }
  });
  */

  /*
  // Tous les jours à 3h : badge projets trending
  cron.schedule("0 3 * * *", async () => {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const trending = await prisma.project.findMany({
        where: {
          status: "active",
          updatedAt: { gte: yesterday },
          viewsCount: { gte: 500 },
        },
        select: { id: true, authorId: true, title: true },
      });

      for (const project of trending) {
        await checkAndAwardBadges(project.authorId, "project_published", {
          projectId: project.id,
        }).catch(console.error);

        await createNotification({
          userId: project.authorId,
          type: "badge",
          title: "🔥 Votre projet performe fortement",
          body: `"${project.title}" a atteint 500+ vues récemment.`,
          actionUrl: `/projects/${project.id}`,
        }).catch(console.error);
      }

      if (trending.length > 0) {
        console.log(
          `[CRON] ${trending.length} projet(s) à forte traction détecté(s)`,
        );
      }
    } catch (err) {
      console.error("[CRON] Badges trending :", err.message);
    }
  });
  */

  /*
  // Tous les dimanches à minuit : nettoyage notifs lues anciennes
  cron.schedule("0 0 * * 0", async () => {
    try {
      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const result = await prisma.notification.deleteMany({
        where: {
          isRead: true,
          createdAt: { lt: threeMonthsAgo },
        },
      });

      if (result.count > 0) {
        console.log(
          `[CRON] ${result.count} vieille(s) notification(s) nettoyée(s)`,
        );
      }
    } catch (err) {
      console.error("[CRON] Nettoyage notifs :", err.message);
    }
  });
  */

  // Toutes les heures : log de santé simple (pas de requête BD)
  cron.schedule("0 * * * *", () => {
    console.log(`[CRON] ${new Date().toISOString()} — Heartbeat OK`);
  });
}
