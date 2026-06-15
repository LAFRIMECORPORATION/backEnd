// configuration upload de fichiers sur cloudinary //
// ============================================================
// LAUNCHPAD — config/cloudinary.js
// Configuration Cloudinary pour upload de fichiers
// Deux buckets : public (avatars, projets) et kyc (privé)
// ============================================================

import { v2 as cloudinary } from "cloudinary";
import { env } from "./env.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key:    env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// ── Dossiers Cloudinary ───────────────────────────────────
export const FOLDERS = {
  AVATARS:   "launchpad/avatars",
  PROJECTS:  "launchpad/projects",
  PITCHDECKS:"launchpad/pitchdecks",
  KYC:       "launchpad/kyc",          // Accès privé
};

// ── Upload avatar (public, transformation auto) ───────────
export async function uploadAvatar(fileBuffer, userId) {
  return cloudinary.uploader.upload_stream(
    {
      folder:         FOLDERS.AVATARS,
      public_id:      `avatar_${userId}`,
      overwrite:      true,
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    },
    (error, result) => {
      if (error) throw error;
      return result;
    }
  );
}

// ── Upload image projet (public) ──────────────────────────
export async function uploadProjectCover(fileBuffer, projectId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:         FOLDERS.PROJECTS,
        public_id:      `cover_${projectId}`,
        overwrite:      true,
        transformation: [
          { width: 1200, height: 630, crop: "fill" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
}

// ── Upload document KYC (privé, accès signé) ─────────────
export async function uploadKycDocument(fileBuffer, userId, docType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:    FOLDERS.KYC,
        public_id: `kyc_${userId}_${docType}_${Date.now()}`,
        type:      "authenticated",   // Accès privé
        resource_type: "auto",        // PDF + images
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
}

// ── Générer URL signée temporaire (1h) pour docs KYC ─────
export function getSignedKycUrl(publicId) {
  return cloudinary.url(publicId, {
    type:       "authenticated",
    sign_url:   true,
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 heure
  });
}

// ── Supprimer un fichier Cloudinary ──────────────────────
export async function deleteFile(publicId, resourceType = "image") {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
}

export default cloudinary;