// helper reponses http  //
// ============================================================
// LAUNCHPAD — utils/response.js
// Helpers pour les réponses API uniformes
// ============================================================

// ── Réponse succès ────────────────────────────────────────
export function success(res, data = null, message = "Succès", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

// ── Réponse liste paginée ────────────────────────────────
export function paginated(res, { data, page, limit, total }) {
  const totalPages = Math.ceil(total / limit);

  return res.status(200).json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}

// ── Réponse créé ─────────────────────────────────────────
export function created(res, data, message = "Créé avec succès") {
  return success(res, data, message, 201);
}

// ── Réponse vide (204) ────────────────────────────────────
export function noContent(res) {
  return res.status(204).send();
}

// ── Helper pagination depuis query params ────────────────
export function getPagination(query) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 12));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}