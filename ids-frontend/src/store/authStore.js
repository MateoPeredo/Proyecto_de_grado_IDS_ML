import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: null,
  login: (username) => set({ user: username }),
  logout: () => set({ user: null }),
}));
