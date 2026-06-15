// client HTTP pour le FRONTEND//
// ============================================================
// LAUNCHPAD FRONTEND — src/utils/api.js
// Client HTTP centralisé — remplace les appels mockData
// Chemin : src/utils/api.js  🆕 NOUVEAU FICHIER FRONTEND
//
// Gère automatiquement :
//   - Ajout du token JWT dans chaque requête
//   - Refresh automatique si le token expire (401)
//   - Format d'erreur uniforme
//   - Base URL depuis les variables d'environnement Vite
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// ── Stockage des tokens en mémoire ───────────────────────
// NE PAS utiliser localStorage pour l'access token (XSS)
// Le refresh token est dans un cookie HttpOnly (géré par le navigateur)
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
}

// ── Helper fetch avec gestion auto du token ───────────────
async function fetchWithAuth(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
    credentials: "include", // Pour les cookies (refresh token)
  });

  // ── Refresh automatique si token expiré ──────────────
  if (response.status === 401 && accessToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Relancer la requête originale avec le nouveau token
      headers["Authorization"] = `Bearer ${accessToken}`;
      return fetch(`${BASE_URL}${url}`, { ...options, headers, credentials: "include" });
    }
  }

  return response;
}

// ── Tenter de rafraîchir le token ─────────────────────────
async function tryRefreshToken() {
  try {
    const refreshToken = localStorage.getItem("launchpad_refresh_token");
    if (!refreshToken) return false;

    const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearAccessToken();
      localStorage.removeItem("launchpad_refresh_token");
      return false;
    }

    const data = await res.json();
    setAccessToken(data.data.accessToken);
    localStorage.setItem("launchpad_refresh_token", data.data.refreshToken);
    return true;

  } catch {
    return false;
  }
}

// ── Parser la réponse et lever une erreur si nécessaire ──
async function parseResponse(response) {
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "Une erreur est survenue.");
    error.code   = data.error;
    error.status = response.status;
    error.data   = data;
    throw error;
  }

  return data;
}

// ══════════════════════════════════════════════════════════
// MÉTHODES HTTP
// ══════════════════════════════════════════════════════════

export const api = {

  // ── GET ─────────────────────────────────────────────────
  async get(url, params = {}) {
    const query = new URLSearchParams(params).toString();
    const fullUrl = query ? `${url}?${query}` : url;
    const response = await fetchWithAuth(fullUrl, { method: "GET" });
    return parseResponse(response);
  },

  // ── POST ────────────────────────────────────────────────
  async post(url, body = {}) {
    const response = await fetchWithAuth(url, {
      method:  "POST",
      body:    JSON.stringify(body),
    });
    return parseResponse(response);
  },

  // ── PUT ─────────────────────────────────────────────────
  async put(url, body = {}) {
    const response = await fetchWithAuth(url, {
      method:  "PUT",
      body:    JSON.stringify(body),
    });
    return parseResponse(response);
  },

  // ── DELETE ──────────────────────────────────────────────
  async delete(url) {
    const response = await fetchWithAuth(url, { method: "DELETE" });
    return parseResponse(response);
  },

  // ── Upload fichier (multipart/form-data) ────────────────
  async upload(url, file, fieldName = "file", extraFields = {}) {
    const formData = new FormData();
    formData.append(fieldName, file);
    Object.entries(extraFields).forEach(([k, v]) => formData.append(k, v));

    const headers = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const response = await fetch(`${BASE_URL}${url}`, {
      method:      "POST",
      headers,
      body:        formData,
      credentials: "include",
    });

    return parseResponse(response);
  },
};

// ══════════════════════════════════════════════════════════
// SERVICES PAR MODULE
// Remplacent les appels directs à mockData
// ══════════════════════════════════════════════════════════

// ── AUTH ─────────────────────────────────────────────────
export const authApi = {
  register: (data)          => api.post("/auth/register", data),
  login:    (data)          => api.post("/auth/login", data),
  logout:   ()              => api.post("/auth/logout"),
  refresh:  (refreshToken)  => api.post("/auth/refresh-token", { refreshToken }),
  me:       ()              => api.get("/auth/me"),
};

// ── USERS ────────────────────────────────────────────────
export const usersApi = {
  getById:      (id)         => api.get(`/users/${id}`),
  update:       (id, data)   => api.put(`/users/${id}`, data),
  uploadAvatar: (id, file)   => api.upload(`/users/${id}/avatar`, file, "avatar"),
};

// ── KYC (Phase 2) ────────────────────────────────────────
export const kycApi = {
  getStatus:     ()          => api.get("/kyc/status"),
  submit:        (formData)  => api.upload("/kyc/submit", null, null, formData),
  // Admin
  getPending:    (params)    => api.get("/admin/kyc/pending", params),
  approve:       (userId)    => api.put(`/admin/kyc/${userId}/approve`),
  reject:        (userId, reason) => api.put(`/admin/kyc/${userId}/reject`, { reason }),
  requestDocs:   (userId, docs)   => api.post(`/admin/kyc/${userId}/request-docs`, { docs }),
};

// ── PROJECTS (Phase 3) ───────────────────────────────────
export const projectsApi = {
  list:        (params)       => api.get("/projects", params),
  getById:     (id)           => api.get(`/projects/${id}`),
  create:      (data)         => api.post("/projects", data),
  update:      (id, data)     => api.put(`/projects/${id}`, data),
  delete:      (id)           => api.delete(`/projects/${id}`),
  publish:     (id)           => api.post(`/projects/${id}/publish`),
  like:        (id)           => api.post(`/projects/${id}/like`),
  save:        (id)           => api.post(`/projects/${id}/save`),
  comment:     (id, content)  => api.post(`/projects/${id}/comments`, { content }),
  similar:     (id)           => api.get(`/projects/${id}/similar`),
  // Admin
  approve:     (id, note)     => api.put(`/admin/projects/${id}/approve`, { note }),
  reject:      (id, reason)   => api.put(`/admin/projects/${id}/reject`, { reason }),
};

// ── MESSAGES (Phase 4) ───────────────────────────────────
export const messagesApi = {
  getConversations:   ()              => api.get("/conversations"),
  getConversation:    (id)            => api.get(`/conversations/${id}`),
  getMessages:        (convId, p)     => api.get(`/conversations/${convId}/messages`, p),
  createDirect:       (targetUserId)  => api.post("/conversations/direct", { targetUserId }),
  sendMessage:        (convId, text)  => api.post("/messages", { conversationId: convId, content: text }),
};

// ── PAYMENTS (Phase 5) ───────────────────────────────────
export const paymentsApi = {
  initStripe:    (data) => api.post("/payments/stripe/init", data),
  initMtn:       (data) => api.post("/payments/mtn/init", data),
  initOrange:    (data) => api.post("/payments/orange/init", data),
  getStatus:     (id)   => api.get(`/payments/${id}/status`),
  getInvestments:()     => api.get("/investments"),
};

// ── NOTIFICATIONS (Phase 6) ──────────────────────────────
export const notificationsApi = {
  getAll:       (params) => api.get("/notifications", params),
  markAllRead:  ()       => api.put("/notifications/mark-all-read"),
  delete:       (id)     => api.delete(`/notifications/${id}`),
  subscribe:    (sub)    => api.post("/notifications/push/subscribe", sub),
};

// ── FORUM (Phase 6) ──────────────────────────────────────
export const forumApi = {
  getPosts:    (params)        => api.get("/forum/posts", params),
  getPost:     (id)            => api.get(`/forum/posts/${id}`),
  createPost:  (data)          => api.post("/forum/posts", data),
  like:        (id)            => api.post(`/forum/posts/${id}/like`),
  reply:       (id, content)   => api.post(`/forum/posts/${id}/replies`, { content }),
};

// ── APPOINTMENTS (Phase 6) ───────────────────────────────
export const appointmentsApi = {
  getAll:       ()           => api.get("/appointments"),
  create:       (data)       => api.post("/appointments", data),
  update:       (id, data)   => api.put(`/appointments/${id}`, data),
  cancel:       (id)         => api.delete(`/appointments/${id}`),
  getSlots:     (userId)     => api.get(`/availability/${userId}`),
};

// ── DUE DILIGENCE (Phase 7) ──────────────────────────────
export const dueDiligenceApi = {
  analyze:    (projectId)  => api.post("/due-diligence/analyze", { projectId }),
  getReport:  (projectId)  => api.get(`/due-diligence/${projectId}`),
};

// ── ADMIN ─────────────────────────────────────────────────
export const adminApi = {
  getStats:    ()      => api.get("/admin/statistics"),
  getUsers:    (p)     => api.get("/admin/users", p),
  getProjects: (p)     => api.get("/admin/projects", p),
};