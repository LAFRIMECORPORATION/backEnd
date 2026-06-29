// ============================================================
// LAUNCHPAD — projects/projects.controller.js
// Controllers HTTP du module Projets — Version Sécurisée Anti-Casse
// ============================================================

import * as projectsService from "./projects.service.js";
import { success, created, paginated, noContent, getPagination } from "../../utils/response.js";
import { AppError } from "../../middleware/errorHandler.js";

// ── POST /api/projects ────────────────────────────────────
export async function createProject(req, res, next) {
  try {
    // 🛡️ Nettoyage manuel supprimé : Zod gère déjà le toLowerPreprocess en toute sécurité
    const project = await projectsService.createProject(req.user.id, req.body);
    return created(res, { project }, "Projet créé en brouillon.");
  } catch (error) { next(error); }
}

// ── POST /api/projects/:id/cover ──────────────────────────
export async function uploadCover(req, res, next) {
  try {
    if (!req.file) throw new AppError("Aucun fichier fourni.", 400, "NO_FILE");
    const project = await projectsService.uploadCover(
      req.params.id, req.user.id, req.file.buffer
    );
    return success(res, { project }, "Image de couverture mise à jour.");
  } catch (error) { next(error); }
}

// ── POST /api/projects/:id/publish ────────────────────────
export async function publishProject(req, res, next) {
  try {
    const project = await projectsService.publishProject(req.params.id, req.user.id);
    return success(res, { project }, "Projet soumis pour modération.");
  } catch (error) { next(error); }
}

// ── GET /api/projects ─────────────────────────────────────
export async function listProjects(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const { category, stage, minGoal, maxGoal, search, sort, status, authorId } = req.query;
    
    const { projects, total } = await projectsService.listProjects({
      page, 
      limit, 
      category, 
      stage, // Déjà géré par Zod validateQuery
      minGoal, 
      maxGoal, 
      search, 
      sort, 
      status, // Déjà géré par Zod validateQuery
      authorId,
    });
    return paginated(res, { data: projects, page, limit, total });
  } catch (error) { next(error); }
}

// ── GET /api/projects/mine ────────────────────────────────
export async function listMyProjects(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const { projects, total } = await projectsService.listProjects({
      page, limit, authorId: req.user.id,
    });
    return paginated(res, { data: projects, page, limit, total });
  } catch (error) { next(error); }
}

// ── GET /api/projects/:id ─────────────────────────────────
export async function getProjectById(req, res, next) {
  try {
    const targetId = req.params.id;

    // 🛡️ SÉCURITÉ DOUBLES ROUTES : Évite que le mot-clé "pending" de l'admin soit traité comme un ID de projet
    if (targetId === "pending") {
      return next(); 
    }

    const project = await projectsService.getProjectById(targetId, req.user?.id);
    return success(res, { project });
  } catch (error) { next(error); }
}

// ── PUT /api/projects/:id ─────────────────────────────────
export async function updateProject(req, res, next) {
  try {
    // 🛡️ Nettoyage manuel supprimé pour éviter les crashs sur valeurs Optionnelles undefined
    const project = await projectsService.updateProject(
      req.params.id, req.user.id, req.body, req.user.role
    );
    return success(res, { project }, "Projet mis à jour.");
  } catch (error) { next(error); }
}

// ── DELETE /api/projects/:id ──────────────────────────────
export async function deleteProject(req, res, next) {
  try {
    await projectsService.deleteProject(
      req.params.id, req.user.id, req.user.role
    );
    return noContent(res);
  } catch (error) { next(error); }
}

// ── POST /api/projects/:id/like ───────────────────────────
export async function toggleLike(req, res, next) {
  try {
    const targetId = req.params.id;
    if (!targetId || targetId === "undefined") {
      throw new AppError("Identifiant de projet manquant ou invalide.", 400, "INVALID_PROJECT_ID");
    }

    const result = await projectsService.toggleLike(targetId, req.user.id);
    
    return success(res, {
      id: targetId,
      likesCount: result.likesCount ?? result.likes ?? 0,
      likedByMe: result.likedByMe ?? false,
      ...result
    });
  } catch (error) { next(error); }
}

// ── POST /api/projects/:id/save ───────────────────────────
export async function toggleSave(req, res, next) {
  try {
    const result = await projectsService.toggleSave(req.params.id, req.user.id);
    return success(res, result);
  } catch (error) { next(error); }
}

// ── POST /api/projects/:id/comments ──────────────────────
export async function addComment(req, res, next) {
  try {
    const targetId = req.params.id;
    if (!targetId || targetId === "undefined") {
      throw new AppError("Identifiant de projet manquant pour le commentaire.", 400, "INVALID_PROJECT_ID");
    }

    // 🛡️ req.body est déjà nettoyé, restructuré et validé par commentSchema de Zod
    const comment = await projectsService.addComment(targetId, req.user.id, req.body);
    
    return created(res, { 
      comment,
      data: comment 
    }, "Commentaire ajouté.");
  } catch (error) { next(error); }
}

// ── GET /api/projects/:id/comments ───────────────────────
export async function getComments(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const { comments, total } = await projectsService.getComments(
      req.params.id, { page, limit }
    );
    return paginated(res, { data: comments, page, limit, total });
  } catch (error) { next(error); }
}

// ── GET /api/projects/:id/similar ────────────────────────
export async function getSimilarProjects(req, res, next) {
  try {
    const projects = await projectsService.getSimilarProjects(req.params.id);
    return success(res, { projects });
  } catch (error) { next(error); }
}

// ── [ADMIN] PUT /api/admin/projects/:id/approve ──────────
export async function approveProject(req, res, next) {
  try {
    const project = await projectsService.approveProject(
      req.params.id, req.user.id, req.body
    );
    return success(res, { project }, "Projet approuvé et publié.");
  } catch (error) { next(error); }
}

// ── [ADMIN] PUT /api/admin/projects/:id/reject ───────────
export async function rejectProject(req, res, next) {
  try {
    const project = await projectsService.rejectProject(
      req.params.id, req.user.id, req.body.reason
    );
    return success(res, { project }, "Projet rejeté.");
  } catch (error) { next(error); }
}

// ── [ADMIN] GET /api/admin/projects/pending ───────────────
export async function listPendingProjects(req, res, next) {
  try {
    const { page, limit } = getPagination(req.query);
    const { projects, total } = await projectsService.listPendingProjects({ page, limit });
    return paginated(res, { data: projects, page, limit, total });
  } catch (error) { next(error); }
}

// ── POST /api/projects/:id/comments/:commentId/like ───────
export async function toggleCommentLike(req, res, next) {
  try {
    const commentId = req.params.commentId;
    if (!commentId || commentId === "undefined") {
      throw new AppError("Identifiant de commentaire manquant ou invalide.", 400, "INVALID_COMMENT_ID");
    }

    const result = await projectsService.toggleCommentLike(commentId, req.user.id);
    
    return success(res, {
      id: commentId,
      likesCount: result.likesCount ?? 0,
      likedByMe: result.likedByMe ?? false,
      ...result
    });
  } catch (error) { next(error); }
}