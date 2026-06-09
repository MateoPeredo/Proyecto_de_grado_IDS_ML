import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
});


api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ids_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let sesionExpiradaNotificada = false;

api.interceptors.response.use(
  (res) => {

    sesionExpiradaNotificada = false;
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("ids_token");
      localStorage.removeItem("ids_user");
      localStorage.removeItem("ids_role");
      // Notifica una sola vez (evita ráfagas de eventos por peticiones en paralelo)
      if (!sesionExpiradaNotificada) {
        sesionExpiradaNotificada = true;
        window.dispatchEvent(new Event("ids:sesion-expirada"));
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authService = {
  login:    (username, password) => api.post("/auth/login", { username, password }),
  logout:   ()                   => api.post("/auth/logout"),
  me:       ()                   => api.get("/auth/me"),
  register: (user)               => api.post("/auth/register", user),
  listUsers:()                   => api.get("/auth/users"),
};

// ── Alerts ───────────────────────────────────────────────────────────────────
export const alertsService = {
  getAll:      (params) => api.get("/alerts", { params }),
  acknowledge: (id)     => api.patch(`/alerts/${id}/ack`),
  ackAll:      ()       => api.post("/alerts/ack-all"),
};

// ── Rules ────────────────────────────────────────────────────────────────────
export const rulesService = {
  getAll:  ()           => api.get("/rules"),
  create:  (rule)       => api.post("/rules", rule),
  update:  (id, rule)   => api.put(`/rules/${id}`, rule),
  toggle:  (id, enabled)=> api.patch(`/rules/${id}`, { enabled }),
  delete:  (id)         => api.delete(`/rules/${id}`),
};

// ── ML ───────────────────────────────────────────────────────────────────────
export const mlService = {
  getMetrics: () => api.get("/ml/metrics"),
  retrain:    () => api.post("/ml/retrain"),
  exportModel:() => api.get("/ml/export", { responseType: "blob" }),
};

// ── Monitor ──────────────────────────────────────────────────────────────────
export const monitorService = {
  getStats:       (minutes) => api.get("/monitor/stats", { params: { minutes } }),
  getAlertsTimeline: (hours) => api.get("/monitor/alerts-timeline", { params: { hours } }),
  getProtocols:   (hours)   => api.get("/monitor/protocols", { params: { hours } }),
};

// ── Config del IDS ───────────────────────────────────────────────────────────
export const configService = {
  get:  ()       => api.get("/config"),
  save: (cfg)    => api.put("/config", cfg),
};

// ── Notificaciones ───────────────────────────────────────────────────────────
export const notificationsService = {
  getAll: ()            => api.get("/notifications"),
  create: (n)           => api.post("/notifications", n),
  update: (id, n)       => api.put(`/notifications/${id}`, n),
  toggle: (id, enabled) => api.patch(`/notifications/${id}`, { enabled }),
  delete: (id)          => api.delete(`/notifications/${id}`),
};
