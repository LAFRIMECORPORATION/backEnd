// ============================================================
// LAUNCHPAD — forum/forum.controller.js
// ============================================================

import { success } from "../../utils/response.js";
import * as forumService from "./forum.service.js";

export async function createPost(req, res, next) {
  try {
    const post = await forumService.createPost(req.user.id, req.body);
    return success(res, post, "Post publié avec succès.", 201);
  } catch (err) { next(err); }
}

export async function listPosts(req, res, next) {
  try {
    const { category, search, sort, page, limit } = req.query;
    const result = await forumService.listPosts(req.user?.id, {
      category, search, sort,
      page:  parseInt(page)  || 1,
      limit: parseInt(limit) || 20,
    });
    return success(res, result);
  } catch (err) { next(err); }
}

export async function getPost(req, res, next) {
  try {
    const post = await forumService.getPost(req.params.id, req.user?.id);
    return success(res, post);
  } catch (err) { next(err); }
}

export async function updatePost(req, res, next) {
  try {
    const post = await forumService.updatePost(req.params.id, req.user.id, req.body);
    return success(res, post, "Post mis à jour.");
  } catch (err) { next(err); }
}

export async function deletePost(req, res, next) {
  try {
    await forumService.deletePost(req.params.id, req.user.id, req.user.role);
    return success(res, null, "Post supprimé.");
  } catch (err) { next(err); }
}

export async function toggleLike(req, res, next) {
  try {
    const result = await forumService.toggleLike(req.params.id, req.user.id);
    return success(res, result);
  } catch (err) { next(err); }
}

export async function addReply(req, res, next) {
  try {
    const reply = await forumService.addReply(req.params.id, req.user.id, req.body);
    return success(res, reply, "Réponse publiée.", 201);
  } catch (err) { next(err); }
}

export async function toggleReplyLike(req, res, next) {
  try {
    const result = await forumService.toggleReplyLike(req.params.replyId, req.user.id);
    return success(res, result);
  } catch (err) { next(err); }
}

export async function togglePin(req, res, next) {
  try {
    const result = await forumService.togglePin(req.params.id);
    return success(res, result);
  } catch (err) { next(err); }
}