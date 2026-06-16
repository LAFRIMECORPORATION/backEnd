// ============================================================
// LAUNCHPAD — kyc/kyc.service.js
// Logique métier complète du module KYC
//
// Flux étudiant :
//   Soumet docs → status="submitted" → Admin examine
//   → Approuver (kycValidated=true) OU Rejeter (reason)
//
// Flux investisseur : identique
// ============================================================

import prisma from "../../config/database.js";
import { uploadKycDocument, getSignedKycUrl } from "../../config/cloudinary.js";
import {
  sendKycSubmittedEmail,
  sendKycApprovedEmail,
  sendKycRejectedEmail,
  sendKycRequestDocsEmail,
  sendAdminKycNotification,
} from "../../utils/email.js";
import { AppError } from "../../middleware/errorHandler.js";
import { createNotification } from "../notifications/notifications.service.js";

// ── Types de documents acceptés par rôle ─────────────────
const REQUIRED_DOCS_STUDENT  = ["cni_file", "selfie", "certif_scol", "carte_etu"];
const REQUIRED_DOCS_INVESTOR = ["rep_cni_file", "domicile", "rccm_file"];

// ── Vérifier si un document est requis ───────────────────
function getRequiredDocs(role) {
  return role === "student" ? REQUIRED_DOCS_STUDENT : REQUIRED_DOCS_INVESTOR;
}

// ════════════════════════════════════════════════════════════
// SUBMIT KYC — Étudiant ou Investisseur
// POST /kyc/submit
// ════════════════════════════════════════════════════════════
export async function submitKyc(userId, textFields, files) {
  // 1. Récupérer l'utilisateur
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id: true, email: true, role: true,
      firstName: true, lastName: true,
      kycStatus: true, kycValidated: true,
    },
  });

  if (!user) throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");

  // 2. Ne pas re-soumettre si déjà validé
  if (user.kycValidated) {
    throw new AppError("Votre compte est déjà vérifié.", 400, "ALREADY_VERIFIED");
  }

  // 3. Vérifier les documents obligatoires
  const requiredDocs = getRequiredDocs(user.role);
  const uploadedDocTypes = Object.keys(files);
  const missingDocs = requiredDocs.filter((doc) => !uploadedDocTypes.includes(doc));

  if (missingDocs.length > 0) {
    throw new AppError(
      `Documents manquants : ${missingDocs.join(", ")}`,
      400,
      "MISSING_DOCUMENTS"
    );
  }

  // 4. Uploader chaque document sur Cloudinary (bucket privé)
  const uploadedFiles = [];

  for (const [docType, fileBuffer] of Object.entries(files)) {
    try {
      const result = await uploadKycDocument(fileBuffer, userId, docType);
      uploadedFiles.push({
        docType,
        cloudinaryId:  result.public_id,
        cloudinaryUrl: result.secure_url,
        fileFormat:    result.format,
        fileSize:      result.bytes,
      });
    } catch (uploadError) {
      throw new AppError(
        `Erreur lors de l'upload du document ${docType}.`,
        500,
        "UPLOAD_ERROR"
      );
    }
  }

  // 5. Transaction : sauvegarder en DB
  await prisma.$transaction(async (tx) => {
    // Supprimer les anciens docs si re-soumission
    await tx.kycDocument.deleteMany({ where: { userId } });

    // Créer les nouveaux documents
    await tx.kycDocument.createMany({
      data: uploadedFiles.map((f) => ({
        userId,
        docType:      f.docType,
        cloudinaryId: f.cloudinaryId,
        status:       "pending",
      })),
    });

    // Sauvegarder les données texte du formulaire
    await tx.kycFormData.upsert({
      where:  { userId },
      create: { userId, formData: textFields },
      update: { formData: textFields },
    });

    // Mettre à jour le statut KYC
    await tx.user.update({
      where: { id: userId },
      data:  { kycStatus: "submitted" },
    });
  });

  // 6. Notifier l'utilisateur et les admins (asynchrone)
  sendKycSubmittedEmail(user).catch(console.error);

  // Récupérer les admins pour les notifier
  const admins = await prisma.user.findMany({
    where:  { role: "admin", isActive: true },
    select: { id: true, email: true, firstName: true },
  });

  for (const admin of admins) {
    // Notification in-app
    createNotification({
      userId:    admin.id,
      type:      "kyc",
      title:     "Nouveau dossier KYC à examiner",
      body:      `${user.firstName} ${user.lastName} a soumis son dossier KYC.`,
      actionUrl: "/admin/kyc",
    }).catch(console.error);

    // Email admin
    sendAdminKycNotification(admin, user).catch(console.error);
  }

  return { message: "Dossier KYC soumis avec succès. Résultat sous 24–48h." };
}

// ════════════════════════════════════════════════════════════
// GET KYC STATUS — Voir son propre statut
// GET /kyc/status
// ════════════════════════════════════════════════════════════
export async function getKycStatus(userId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      kycStatus:    true,
      kycValidated: true,
      kycDocuments: {
        select: {
          id:        true,
          docType:   true,
          status:    true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      kycFormData: {
        select: { formData: true },
      },
    },
  });

  if (!user) throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");

  return {
    kycStatus:    user.kycStatus,
    kycValidated: user.kycValidated,
    docsCount:    user.kycDocuments.length,
    documents:    user.kycDocuments,
    submittedAt:  user.kycDocuments[0]?.createdAt || null,
  };
}

// ════════════════════════════════════════════════════════════
// [ADMIN] LIST PENDING KYC — Dossiers en attente
// GET /admin/kyc/pending
// ════════════════════════════════════════════════════════════
export async function listPendingKyc({ page = 1, limit = 10, role, search }) {
  const skip = (page - 1) * limit;

  const where = {
    kycStatus: "submitted",
    isActive:  true,
    ...(role   && { role }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName:  { contains: search, mode: "insensitive" } },
        { email:     { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take:    limit,
      orderBy: { updatedAt: "asc" }, // Plus anciens en premier
      select: {
        id:        true,
        email:     true,
        firstName: true,
        lastName:  true,
        role:      true,
        kycStatus: true,
        updatedAt: true,
        profile: {
          select: { university: true, company: true, location: true },
        },
        kycDocuments: {
          select: {
            id:          true,
            docType:     true,
            cloudinaryId:true,
            status:      true,
            createdAt:   true,
          },
        },
        kycFormData: {
          select: { formData: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Ajouter des URLs signées temporaires (1h) pour chaque document
  const usersWithSignedUrls = users.map((user) => ({
    ...user,
    kycDocuments: user.kycDocuments.map((doc) => ({
      ...doc,
      // URL signée valide 1 heure — admin seulement
      signedUrl: getSignedKycUrl(doc.cloudinaryId),
    })),
  }));

  return { users: usersWithSignedUrls, total };
}

// ════════════════════════════════════════════════════════════
// [ADMIN] GET KYC DETAIL — Détail d'un dossier
// GET /admin/kyc/:userId
// ════════════════════════════════════════════════════════════
export async function getKycDetail(userId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id:           true,
      email:        true,
      firstName:    true,
      lastName:     true,
      role:         true,
      kycStatus:    true,
      kycValidated: true,
      avatarUrl:    true,
      createdAt:    true,
      updatedAt:    true,
      profile: {
        select: {
          university:  true,
          company:     true,
          location:    true,
          skills:      true,
        },
      },
      kycDocuments: {
        select: {
          id:          true,
          docType:     true,
          cloudinaryId:true,
          status:      true,
          createdAt:   true,
        },
      },
      kycFormData: {
        select: { formData: true, createdAt: true },
      },
    },
  });

  if (!user) throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");

  // Ajouter URLs signées
  const documents = user.kycDocuments.map((doc) => ({
    ...doc,
    signedUrl: getSignedKycUrl(doc.cloudinaryId),
  }));

  return { ...user, kycDocuments: documents };
}

// ════════════════════════════════════════════════════════════
// [ADMIN] APPROVE KYC
// PUT /admin/kyc/:userId/approve
// ════════════════════════════════════════════════════════════
export async function approveKyc(userId, adminId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id: true, email: true, firstName: true,
      lastName: true, role: true,
      kycStatus: true, kycValidated: true,
    },
  });

  if (!user) throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");

  if (user.kycValidated) {
    throw new AppError("Ce compte est déjà vérifié.", 400, "ALREADY_VERIFIED");
  }

  if (user.kycStatus !== "submitted") {
    throw new AppError(
      "Aucun dossier soumis à approuver pour cet utilisateur.",
      400,
      "NO_PENDING_KYC"
    );
  }

  // Transaction : valider le KYC + logger l'action
  await prisma.$transaction(async (tx) => {
    // 1. Valider le KYC
    await tx.user.update({
      where: { id: userId },
      data:  {
        kycValidated: true,
        kycStatus:    "approved",
      },
    });

    // 2. Marquer tous les documents comme approuvés
    await tx.kycDocument.updateMany({
      where: { userId },
      data:  { status: "approved" },
    });

    // 3. Logger dans audit_logs
    await tx.auditLog.create({
      data: {
        actorId:    adminId,
        action:     "KYC_APPROVED",
        entityType: "user",
        entityId:   userId,
        newValues:  { kycValidated: true, kycStatus: "approved" },
      },
    });
  });

  // Attribuer le badge "Profil vérifié" automatiquement
  await prisma.userBadge.upsert({
    where: {
      // Éviter les doublons
      userId_badgeType: { userId, badgeType: "verified" },
    },
    create: {
      userId,
      badgeType:    "verified",
      badgeLabel:   "Profil vérifié",
      badgeIcon:    "✓",
      pointsAwarded: 20,
      awardedBy:    "system",
    },
    update: {},
  }).catch(() => {
    // Si contrainte unique pas encore en place, ignorer
    prisma.userBadge.create({
      data: {
        userId,
        badgeType:    "verified",
        badgeLabel:   "Profil vérifié",
        badgeIcon:    "✓",
        pointsAwarded: 20,
        awardedBy:    "system",
      },
    }).catch(console.error);
  });

  // Mettre à jour le score de réputation (+20 pts badge)
  await prisma.user.update({
    where: { id: userId },
    data:  { reputationScore: { increment: 20 } },
  });

  // Notifications asynchrones
  sendKycApprovedEmail(user).catch(console.error);
  createNotification({
    userId:    userId,
    type:      "kyc",
    title:     "✅ Compte vérifié !",
    body:      "Votre identité a été confirmée. Vous avez maintenant accès à toutes les fonctionnalités.",
    actionUrl: user.role === "student" ? "/dashboard-student" : "/dashboard-investor",
  }).catch(console.error);

  return { message: `KYC de ${user.firstName} ${user.lastName} approuvé avec succès.` };
}

// ════════════════════════════════════════════════════════════
// [ADMIN] REJECT KYC
// PUT /admin/kyc/:userId/reject
// ════════════════════════════════════════════════════════════
export async function rejectKyc(userId, adminId, reason) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id: true, email: true, firstName: true,
      lastName: true, role: true, kycStatus: true,
    },
  });

  if (!user) throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");

  if (user.kycStatus !== "submitted") {
    throw new AppError(
      "Aucun dossier soumis à rejeter pour cet utilisateur.",
      400,
      "NO_PENDING_KYC"
    );
  }

  await prisma.$transaction(async (tx) => {
    // 1. Rejeter le KYC
    await tx.user.update({
      where: { id: userId },
      data:  {
        kycValidated: false,
        kycStatus:    "rejected",
      },
    });

    // 2. Marquer les documents comme rejetés
    await tx.kycDocument.updateMany({
      where: { userId },
      data:  { status: "rejected" },
    });

    // 3. Sauvegarder la raison du rejet dans les form data
    await tx.kycFormData.upsert({
      where:  { userId },
      create: { userId, formData: {}, rejectionReason: reason },
      update: { rejectionReason: reason },
    });

    // 4. Logger dans audit_logs
    await tx.auditLog.create({
      data: {
        actorId:    adminId,
        action:     "KYC_REJECTED",
        entityType: "user",
        entityId:   userId,
        newValues:  { kycStatus: "rejected", reason },
      },
    });
  });

  // Notifications
  sendKycRejectedEmail(user, reason).catch(console.error);
  createNotification({
    userId:    userId,
    type:      "kyc",
    title:     "❌ Vérification KYC refusée",
    body:      "Votre dossier n'a pas pu être validé. Consultez votre email pour les détails.",
    actionUrl: "/kyc-verification",
  }).catch(console.error);

  return { message: `KYC de ${user.firstName} ${user.lastName} rejeté.` };
}

// ════════════════════════════════════════════════════════════
// [ADMIN] REQUEST MORE DOCS
// POST /admin/kyc/:userId/request-docs
// ════════════════════════════════════════════════════════════
export async function requestMoreDocs(userId, adminId, { missingDocs, message }) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id: true, email: true, firstName: true,
      lastName: true, role: true,
    },
  });

  if (!user) throw new AppError("Utilisateur introuvable.", 404, "NOT_FOUND");

  // Logger l'action admin
  await prisma.auditLog.create({
    data: {
      actorId:    adminId,
      action:     "KYC_DOCS_REQUESTED",
      entityType: "user",
      entityId:   userId,
      newValues:  { missingDocs, message },
    },
  });

  // Sauvegarder les docs manquants dans les form data
  await prisma.kycFormData.upsert({
    where:  { userId },
    create: { userId, formData: {}, requestedDocs: missingDocs },
    update: { requestedDocs: missingDocs },
  });

  // Notification email
  sendKycRequestDocsEmail(user, missingDocs, message).catch(console.error);

  // Notification in-app
  createNotification({
    userId:    userId,
    type:      "kyc",
    title:     "📋 Documents supplémentaires requis",
    body:      `Notre équipe a besoin de documents supplémentaires : ${missingDocs.join(", ")}.`,
    actionUrl: "/kyc-verification",
  }).catch(console.error);

  return { message: "Demande de documents envoyée à l'utilisateur." };
}

// ════════════════════════════════════════════════════════════
// [ADMIN] KYC STATISTICS
// GET /admin/kyc/stats
// ════════════════════════════════════════════════════════════
export async function getKycStats() {
  const [pending, approved, rejected, total] = await Promise.all([
    prisma.user.count({ where: { kycStatus: "submitted" } }),
    prisma.user.count({ where: { kycStatus: "approved"  } }),
    prisma.user.count({ where: { kycStatus: "rejected"  } }),
    prisma.user.count({ where: { role: { in: ["student", "investor"] } } }),
  ]);

  return {
    pending,
    approved,
    rejected,
    total,
    pendingStudents:   await prisma.user.count({ where: { kycStatus: "submitted", role: "student"  } }),
    pendingInvestors:  await prisma.user.count({ where: { kycStatus: "submitted", role: "investor" } }),
  };
}