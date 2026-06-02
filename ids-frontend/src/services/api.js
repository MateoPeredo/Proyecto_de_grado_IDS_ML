import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ids_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("ids_token");
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authService = {
  login:  (username, password) => api.post("/auth/login", { username, password }),
  logout: ()                   => api.post("/auth/logout"),
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
  getStats: () => api.get("/monitor/stats"),
};
