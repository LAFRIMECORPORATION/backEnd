// ============================================================
// LAUNCHPAD — appointments/appointments.service.js
// Rendez-vous entre investisseurs et porteurs de projets
// Intégration Cal.com (optionnelle) + système custom
// ============================================================

import prisma  from "../../config/database.js";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";
// import { sendAppointmentEmail } from "../../utils/email.js"; // TODO: implémenter sendAppointmentEmail

// ════════════════════════════════════════════════════════════
// CRÉER UN RENDEZ-VOUS
// POST /api/appointments
// ════════════════════════════════════════════════════════════
export async function createAppointment(organizerId, {
  participantId,
  projectId,
  title,
  scheduledAt,
  durationMin = 45,
  notes,
}) {
  // Vérifier que l'invité existe
  const invitee = await prisma.user.findUnique({
    where:  { id: participantId },
    select: { id: true, firstName: true, email: true },
  });
  if (!invitee) throw new AppError("Utilisateur invité introuvable.", 404, "NOT_FOUND");

  // Vérifier le projet si fourni
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");
  }

  // Créer le rendez-vous
  const appointment = await prisma.appointment.create({
    data: {
      organizerId,
      participantId,
      projectId:   projectId || null,
      title,
      scheduledAt:  scheduledAt ? new Date(scheduledAt) : null,
      durationMin,
      status:      "pending",
      notes:        notes || null,
    },
    select: _appointmentSelect(),
  });

  // Notifier l'invité
  const requester = await prisma.user.findUnique({
    where:  { id: organizerId },
    select: { firstName: true, lastName: true },
  });

  createNotification({
    userId:    participantId,
    type:      "appointment",
    title:     "📅 Nouvelle demande de rendez-vous",
    body:      `${requester.firstName} ${requester.lastName} souhaite planifier un rendez-vous : "${title}"`,
    actionUrl: "/appointments",
  }).catch(console.error);

  return appointment;
}

// ════════════════════════════════════════════════════════════
// LISTER LES RENDEZ-VOUS DE L'UTILISATEUR
// GET /api/appointments
// ════════════════════════════════════════════════════════════
export async function listAppointments(userId, { tab = "upcoming", page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;
  const now  = new Date();

  // Tab "upcoming" → RDV confirmés dans le futur
  // Tab "pending"  → En attente de confirmation
  // Tab "past"     → RDV passés
  const where = {
    OR: [{ organizerId: userId }, { participantId: userId }],
    ...(tab === "upcoming" ? {
      status:      "confirmed",
      scheduledAt: { gt: now },
    } : tab === "pending" ? {
      status: "pending",
    } : {
      OR: [
        { status: "completed" },
        { status: "cancelled" },
        { status: "confirmed", scheduledAt: { lt: now } },
      ],
    }),
  };

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { createdAt: "desc" },
      select:  _appointmentSelect(),
    }),
    prisma.appointment.count({ where }),
  ]);

  return { appointments, total, page };
}

// ════════════════════════════════════════════════════════════
// DÉTAIL D'UN RENDEZ-VOUS
// GET /api/appointments/:id
// ════════════════════════════════════════════════════════════
export async function getAppointment(appointmentId, userId) {
  const appt = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      OR: [{ organizerId: userId }, { participantId: userId }],
    },
    select: _appointmentSelect(),
  });

  if (!appt) throw new AppError("Rendez-vous introuvable.", 404, "NOT_FOUND");
  return appt;
}

// ════════════════════════════════════════════════════════════
// CONFIRMER UN RENDEZ-VOUS
// PUT /api/appointments/:id/confirm
// ════════════════════════════════════════════════════════════
export async function confirmAppointment(appointmentId, participantId) {
  const appt = await prisma.appointment.findFirst({
    where:  { id: appointmentId, participantId, status: "pending" },
    select: {
      id: true, title: true, organizerId: true, scheduledAt: true,
      organizer: { select: { firstName: true, email: true } },
      participant:   { select: { firstName: true, email: true } },
    },
  });

  if (!appt) throw new AppError("Rendez-vous introuvable ou non autorisé.", 404, "NOT_FOUND");

  // Générer un lien de meeting
  const meetingUrl = await generateMeetingLink(appointmentId);

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status:     "confirmed",
      meetingUrl,
    },
    select: _appointmentSelect(),
  });

  // Notifier le demandeur
  createNotification({
    userId:    appt.organizerId,
    type:      "appointment",
    title:     "✅ Rendez-vous confirmé !",
    body:      `${appt.participant.firstName} a confirmé votre rendez-vous "${appt.title}"`,
    actionUrl: "/appointments",
  }).catch(console.error);

  // Programmer des rappels
  scheduleReminders(updated).catch(console.error);

  return updated;
}

// ════════════════════════════════════════════════════════════
// REFUSER UN RENDEZ-VOUS
// PUT /api/appointments/:id/decline
// ════════════════════════════════════════════════════════════
export async function declineAppointment(appointmentId, participantId, reason) {
  const appt = await prisma.appointment.findFirst({
    where:  { id: appointmentId, participantId, status: "pending" },
    select: { id: true, organizerId: true, title: true },
  });

  if (!appt) throw new AppError("Rendez-vous introuvable.", 404, "NOT_FOUND");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data:  { status: "cancelled", notes: reason || "" },
  });

  createNotification({
    userId:    appt.organizerId,
    type:      "appointment",
    title:     "❌ Rendez-vous refusé",
    body:      `Votre demande de rendez-vous "${appt.title}" a été refusée.`,
    actionUrl: "/appointments",
  }).catch(console.error);

  return { declined: true };
}

// ════════════════════════════════════════════════════════════
// ANNULER UN RENDEZ-VOUS
// PUT /api/appointments/:id/cancel
// ════════════════════════════════════════════════════════════
export async function cancelAppointment(appointmentId, userId, reason) {
  const appt = await prisma.appointment.findFirst({
    where: {
      id:     appointmentId,
      status: { in: ["pending", "confirmed"] },
      OR:     [{ organizerId: userId }, { participantId: userId }],
    },
    select: {
      id: true, title: true, organizerId: true, participantId: true,
    },
  });

  if (!appt) throw new AppError("Rendez-vous introuvable.", 404, "NOT_FOUND");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data:  { status: "cancelled", notes: reason || "" },
  });

  // Notifier l'autre partie
  const otherUserId = appt.organizerId === userId ? appt.participantId : appt.organizerId;
  createNotification({
    userId:    otherUserId,
    type:      "appointment",
    title:     "❌ Rendez-vous annulé",
    body:      `Le rendez-vous "${appt.title}" a été annulé.`,
    actionUrl: "/appointments",
  }).catch(console.error);

  return { cancelled: true };
}

// ════════════════════════════════════════════════════════════
// DISPONIBILITÉS D'UN UTILISATEUR
// GET /api/appointments/availability/:userId
// ════════════════════════════════════════════════════════════
export async function getAvailability(userId) {
  // Récupérer les RDV confirmés dans les 30 prochains jours
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const confirmedSlots = await prisma.appointment.findMany({
    where: {
      OR:         [{ organizerId: userId }, { participantId: userId }],
      status:     "confirmed",
      scheduledAt: { gt: new Date(), lt: thirtyDaysFromNow },
    },
    select: { scheduledAt: true },
  });

  return {
    userId,
    busySlots: confirmedSlots.map(a => a.scheduledAt),
  };
}

// ════════════════════════════════════════════════════════════
// FONCTIONS INTERNES
// ════════════════════════════════════════════════════════════

// Générer un lien Google Meet (ou Jitsi en fallback)
async function generateMeetingLink(appointmentId) {
  // En production : intégrer Google Calendar API ou Zoom API
  // Pour le MVP : lien Jitsi unique basé sur l'ID du RDV
  const roomId = appointmentId.replace(/-/g, "").substring(0, 12);
  return `https://meet.jit.si/launchpad-${roomId}`;
}

// generateCalcomLink supprimé - fonctionnalité non supportée par le schéma actuel

// Programmer des rappels (J-1 et H-1)
async function scheduleReminders(appointment) {
  if (!appointment.scheduledAt) return;

  const apptTime     = new Date(appointment.scheduledAt).getTime();
  const oneDayBefore = apptTime - 24 * 60 * 60 * 1000;
  const oneHrBefore  = apptTime - 60 * 60 * 1000;
  const now          = Date.now();

  // Rappel J-1
  if (oneDayBefore > now) {
    setTimeout(async () => {
      for (const uid of [appointment.organizerId, appointment.participantId]) {
        createNotification({
          userId:    uid,
          type:      "appointment",
          title:     "📅 Rappel rendez-vous demain",
          body:      `Vous avez un rendez-vous "${appointment.title}" demain.`,
          actionUrl: "/appointments",
        }).catch(console.error);
      }
    }, oneDayBefore - now);
  }

  // Rappel H-1
  if (oneHrBefore > now) {
    setTimeout(async () => {
      for (const uid of [appointment.organizerId, appointment.participantId]) {
        createNotification({
          userId:    uid,
          type:      "appointment",
          title:     "⏰ Rappel rendez-vous dans 1 heure",
          body:      `Votre rendez-vous "${appointment.title}" commence dans 1 heure.`,
          actionUrl: "/appointments",
        }).catch(console.error);
      }
    }, oneHrBefore - now);
  }
}

// Sélecteur réutilisable
function _appointmentSelect() {
  return {
    id:            true,
    title:         true,
    status:        true,
    scheduledAt:   true,
    durationMin:   true,
    meetingUrl:    true,
    notes:         true,
    reminderSent:  true,
    createdAt:     true,
    updatedAt:     true,
    organizer: {
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true,
      },
    },
    participant: {
      select: {
        id: true, firstName: true, lastName: true, avatarUrl: true,
      },
    },
    project: {
      select: { id: true, title: true },
    },
  };
}