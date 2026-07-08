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

// ── Types de rendez-vous ──────────────────────────────────────
export const APPOINTMENT_TYPES = ["pitch", "due_diligence", "suivi", "general"];

// ════════════════════════════════════════════════════════════
// CRÉER UN RENDEZ-VOUS
// POST /api/appointments
// ════════════════════════════════════════════════════════════
export async function createAppointment(requesterId, {
  inviteeId,
  projectId,
  type,
  title,
  description,
  proposedSlots,   // [{ date, startTime, endTime }] — 3 créneaux proposés
  meetingType,     // "video" | "phone" | "in_person"
}) {
  // Vérifier que l'invité existe
  const invitee = await prisma.user.findUnique({
    where:  { id: inviteeId },
    select: { id: true, firstName: true, email: true },
  });
  if (!invitee) throw new AppError("Utilisateur invité introuvable.", 404, "NOT_FOUND");

  // Vérifier le projet si fourni
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new AppError("Projet introuvable.", 404, "NOT_FOUND");
  }

  // Créer le rendez-vous avec les créneaux proposés
  const appointment = await prisma.appointment.create({
    data: {
      requesterId,
      inviteeId,
      projectId:   projectId || null,
      type,
      title,
      description: description || "",
      meetingType: meetingType || "video",
      status:      "pending",
      slots: {
        create: proposedSlots.slice(0, 3).map(s => ({
          date:      new Date(s.date),
          startTime: s.startTime,
          endTime:   s.endTime,
        })),
      },
    },
    select: _appointmentSelect(),
  });

  // Générer un lien Cal.com si configuré
  if (env.CALCOM_API_KEY) {
    generateCalcomLink(appointment.id, requesterId).catch(console.error);
  }

  // Notifier l'invité
  const requester = await prisma.user.findUnique({
    where:  { id: requesterId },
    select: { firstName: true, lastName: true },
  });

  createNotification({
    userId:    inviteeId,
    type:      "appointment",
    title:     "📅 Nouvelle demande de rendez-vous",
    body:      `${requester.firstName} ${requester.lastName} souhaite planifier un rendez-vous : "${title}"`,
    actionUrl: "/appointments",
  }).catch(console.error);

  // sendAppointmentEmail(invitee, appointment, "request").catch(console.error);

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
    OR: [{ requesterId: userId }, { inviteeId: userId }],
    ...(tab === "upcoming" ? {
      status:      "confirmed",
      confirmedAt: { gt: now },
    } : tab === "pending" ? {
      status: "pending",
    } : {
      OR: [
        { status: "completed" },
        { status: "confirmed", confirmedAt: { lt: now } },
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
      OR: [{ requesterId: userId }, { inviteeId: userId }],
    },
    select: _appointmentSelect(),
  });

  if (!appt) throw new AppError("Rendez-vous introuvable.", 404, "NOT_FOUND");
  return appt;
}

// ════════════════════════════════════════════════════════════
// CONFIRMER UN RENDEZ-VOUS (invité choisit un créneau)
// PUT /api/appointments/:id/confirm
// ════════════════════════════════════════════════════════════
export async function confirmAppointment(appointmentId, inviteeId, { slotId }) {
  const appt = await prisma.appointment.findFirst({
    where:  { id: appointmentId, inviteeId, status: "pending" },
    select: {
      id: true, title: true, requesterId: true,
      requester: { select: { firstName: true, email: true } },
      invitee:   { select: { firstName: true, email: true } },
      slots:     { select: { id: true, date: true, startTime: true, endTime: true } },
    },
  });

  if (!appt) throw new AppError("Rendez-vous introuvable ou non autorisé.", 404, "NOT_FOUND");

  const slot = appt.slots.find(s => s.id === slotId);
  if (!slot) throw new AppError("Créneau invalide.", 400, "INVALID_SLOT");

  // Générer un lien de meeting
  const meetingUrl = await generateMeetingLink(appointmentId);

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status:       "confirmed",
      confirmedAt:  new Date(`${slot.date.toISOString().split("T")[0]}T${slot.startTime}`),
      confirmedSlot: slotId,
      meetingUrl,
    },
    select: _appointmentSelect(),
  });

  // Notifier le demandeur
  createNotification({
    userId:    appt.requesterId,
    type:      "appointment",
    title:     "✅ Rendez-vous confirmé !",
    body:      `${appt.invitee.firstName} a confirmé votre rendez-vous "${appt.title}"`,
    actionUrl: "/appointments",
  }).catch(console.error);

  // sendAppointmentEmail(appt.requester, updated, "confirmed").catch(console.error);
  // sendAppointmentEmail(appt.invitee,   updated, "confirmed").catch(console.error);

  // Programmer des rappels
  scheduleReminders(updated).catch(console.error);

  return updated;
}

// ════════════════════════════════════════════════════════════
// REFUSER UN RENDEZ-VOUS
// PUT /api/appointments/:id/decline
// ════════════════════════════════════════════════════════════
export async function declineAppointment(appointmentId, inviteeId, reason) {
  const appt = await prisma.appointment.findFirst({
    where:  { id: appointmentId, inviteeId, status: "pending" },
    select: { id: true, requesterId: true, title: true },
  });

  if (!appt) throw new AppError("Rendez-vous introuvable.", 404, "NOT_FOUND");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data:  { status: "declined", declineReason: reason || "" },
  });

  createNotification({
    userId:    appt.requesterId,
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
      OR:     [{ requesterId: userId }, { inviteeId: userId }],
    },
    select: {
      id: true, title: true, requesterId: true, inviteeId: true,
    },
  });

  if (!appt) throw new AppError("Rendez-vous introuvable.", 404, "NOT_FOUND");

  await prisma.appointment.update({
    where: { id: appointmentId },
    data:  { status: "cancelled", cancelReason: reason || "" },
  });

  // Notifier l'autre partie
  const otherUserId = appt.requesterId === userId ? appt.inviteeId : appt.requesterId;
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
      OR:     [{ requesterId: userId }, { inviteeId: userId }],
      status: "confirmed",
      confirmedAt: { gt: new Date(), lt: thirtyDaysFromNow },
    },
    select: { confirmedAt: true },
  });

  return {
    userId,
    busySlots: confirmedSlots.map(a => a.confirmedAt),
    calcomUrl: env.CALCOM_API_KEY
      ? `https://cal.com/launchpad/${userId}`
      : null,
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

// Générer un lien Cal.com (si configuré)
async function generateCalcomLink(appointmentId, userId) {
  if (!env.CALCOM_API_KEY) return null;
  try {
    const res = await fetch("https://api.cal.com/v1/bookings", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${env.CALCOM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ appointmentId, userId }),
    });
    const data = await res.json();
    if (data?.booking?.id) {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data:  { calcomBookingId: data.booking.id },
      });
    }
  } catch (err) {
    console.error("Cal.com error:", err.message);
  }
}

// Programmer des rappels (J-1 et H-1)
async function scheduleReminders(appointment) {
  if (!appointment.confirmedAt) return;

  const apptTime     = new Date(appointment.confirmedAt).getTime();
  const oneDayBefore = apptTime - 24 * 60 * 60 * 1000;
  const oneHrBefore  = apptTime - 60 * 60 * 1000;
  const now          = Date.now();

  // Rappel J-1
  if (oneDayBefore > now) {
    setTimeout(async () => {
      for (const uid of [appointment.requesterId, appointment.inviteeId]) {
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
      for (const uid of [appointment.requesterId, appointment.inviteeId]) {
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
    type:          true,
    title:         true,
    description:   true,
    status:        true,
    meetingType:   true,
    meetingUrl:    true,
    confirmedAt:   true,
    declineReason: true,
    cancelReason:  true,
    createdAt:     true,
    requester: {
      select: {
        id: true, firstName: true, lastName: true,
        profile: { select: { avatarUrl: true } },
      },
    },
    invitee: {
      select: {
        id: true, firstName: true, lastName: true,
        profile: { select: { avatarUrl: true } },
      },
    },
    project: {
      select: { id: true, title: true },
    },
    slots: {
      select: { id: true, date: true, startTime: true, endTime: true },
      orderBy: { date: "asc" },
    },
  };
}