import { create } from "zustand";

// Lee el estado inicial desde localStorage para mantener la sesión al recargar
const tokenInicial = localStorage.getItem("ids_token");
const userInicial = localStorage.getItem("ids_user");
const roleInicial = localStorage.getItem("ids_role");

export const useAuthStore = create((set) => ({
  user: userInicial || null,
  role: roleInicial || null,
  token: tokenInicial || null,

  // Guarda la sesión tras un login exitoso contra el backend
  setSession: ({ username, role, token }) => {
    localStorage.setItem("ids_token", token);
    localStorage.setItem("ids_user", username);
    localStorage.setItem("ids_role", role);
    set({ user: username, role, token });
  },

  logout: () => {
    localStorage.removeItem("ids_token");
    localStorage.removeItem("ids_user");
    localStorage.removeItem("ids_role");
    set({ user: null, role: null, token: null });
  },
}));
