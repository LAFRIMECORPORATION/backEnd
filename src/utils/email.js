//service email Resent //
// ============================================================
// LAUNCHPAD — utils/email.js
// Service d'envoi d'emails via Resend
// ============================================================

import { Resend } from "resend";
import { env } from "../config/env.js";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const FROM = `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`;

// ── Helper interne ────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.log(`📧 [DEV] Email non envoyé (RESEND_API_KEY manquant)`);
    console.log(`   À : ${to}`);
    console.log(`   Sujet : ${subject}`);
    return;
  }

  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (error) {
    // Ne pas bloquer le flux principal si l'email échoue
    console.error("❌ Erreur envoi email :", error.message);
  }
}

// ── Email de bienvenue ────────────────────────────────────
export async function sendWelcomeEmail(user) {
  const roleLabel = user.role === "student" ? "étudiant(e)" : "investisseur";
  await sendEmail({
    to:      user.email,
    subject: "🚀 Bienvenue sur Launchpad !",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2D3A8C, #4F5FCF); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; font-size: 32px; margin: 0;">🚀 Launchpad</h1>
          <p style="color: rgba(255,255,255,0.8); margin-top: 8px;">La plateforme des startups camerounaises</p>
        </div>
        <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1E1B4B;">Bienvenue, ${user.firstName} ! 👋</h2>
          <p style="color: #374151; line-height: 1.6;">
            Votre compte <strong>${roleLabel}</strong> a été créé avec succès.
            ${user.role === "student"
              ? "Vous pouvez maintenant publier vos projets et vous connecter avec des investisseurs."
              : "Vous pouvez maintenant explorer les projets et investir dans les startups camerounaises."}
          </p>
          <div style="background: #FFF8E1; border-left: 4px solid #F59E0B; padding: 16px; border-radius: 4px; margin: 24px 0;">
            <strong style="color: #D97706;">⚠️ Prochaine étape importante</strong>
            <p style="color: #374151; margin: 8px 0 0;">
              Vérifiez votre identité (KYC) pour débloquer toutes les fonctionnalités de la plateforme.
            </p>
          </div>
          <a href="${env.FRONTEND_URL}/kyc-verification"
             style="display: inline-block; background: #4F5FCF; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">
            Vérifier mon compte →
          </a>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
          <p style="color: #9CA3AF; font-size: 12px;">
            Launchpad — Plateforme de mise en relation étudiants × investisseurs<br>
            Cameroun · 2026
          </p>
        </div>
      </div>
    `,
  });
}

// ── Email KYC soumis (confirmation utilisateur) ──────────
export async function sendKycSubmittedEmail(user) {
  await sendEmail({
    to:      user.email,
    subject: "⏳ Votre dossier KYC a été reçu — Launchpad",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1E1B4B; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">🛡️ Vérification KYC</h1>
        </div>
        <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1E1B4B;">Dossier bien reçu, ${user.firstName} !</h2>
          <p style="color: #374151; line-height: 1.6;">
            Votre dossier de vérification a été transmis à notre équipe.
            Le délai de traitement est de <strong>24 à 48 heures ouvrées</strong>.
          </p>
          <p style="color: #374151;">Vous recevrez un email dès que votre dossier est examiné.</p>
          <div style="background: #EFF6FF; border-radius: 8px; padding: 16px; margin-top: 24px;">
            <p style="color: #1D4ED8; margin: 0; font-size: 14px;">
              🔒 Vos documents sont chiffrés et accessibles uniquement à notre équipe de vérification.
            </p>
          </div>
        </div>
      </div>
    `,
  });
}

// ── Email KYC approuvé ────────────────────────────────────
export async function sendKycApprovedEmail(user) {
  await sendEmail({
    to:      user.email,
    subject: "✅ Compte vérifié — Accès complet débloqué !",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #059669, #10B981); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
          <div style="font-size: 64px;">✅</div>
          <h1 style="color: white; margin: 8px 0;">Compte Vérifié !</h1>
        </div>
        <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1E1B4B;">Félicitations, ${user.firstName} ! 🎉</h2>
          <p style="color: #374151; line-height: 1.6;">
            Votre identité a été vérifiée avec succès. Vous avez maintenant accès à
            <strong>toutes les fonctionnalités de Launchpad</strong>.
          </p>
          <div style="display: grid; gap: 12px; margin: 24px 0;">
            ${user.role === "student"
              ? `<p style="color: #059669;">✅ Publier vos projets</p>
                 <p style="color: #059669;">✅ Accéder au Marketplace</p>
                 <p style="color: #059669;">✅ Collaborer avec d'autres étudiants</p>`
              : `<p style="color: #059669;">✅ Investir dans les projets</p>
                 <p style="color: #059669;">✅ Accéder à la Due Diligence IA</p>
                 <p style="color: #059669;">✅ Planifier des rendez-vous</p>`
            }
          </div>
          <a href="${env.FRONTEND_URL}"
             style="display: inline-block; background: #059669; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Accéder à Launchpad →
          </a>
        </div>
      </div>
    `,
  });
}

// ── Email KYC rejeté ─────────────────────────────────────
export async function sendKycRejectedEmail(user, reason) {
  await sendEmail({
    to:      user.email,
    subject: "❌ Vérification KYC — Action requise",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #DC2626; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">❌ Vérification refusée</h1>
        </div>
        <div style="background: white; padding: 40px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1E1B4B;">Bonjour ${user.firstName},</h2>
          <p style="color: #374151; line-height: 1.6;">
            Après examen de votre dossier, notre équipe n'a pas pu valider votre vérification KYC.
          </p>
          ${reason ? `
          <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 16px; border-radius: 4px; margin: 20px 0;">
            <strong style="color: #DC2626;">Raison :</strong>
            <p style="color: #374151; margin: 8px 0 0;">${reason}</p>
          </div>` : ""}
          <p style="color: #374151;">
            Vous pouvez soumettre un nouveau dossier en corrigeant les points mentionnés.
          </p>
          <a href="${env.FRONTEND_URL}/kyc-verification"
             style="display: inline-block; background: #4F5FCF; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
            Re-soumettre mon dossier →
          </a>
        </div>
      </div>
    `,
  });
}