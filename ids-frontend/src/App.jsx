import { useEffect } from "react";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { useAuthStore } from "./store/authStore";
import { LoginPage } from "./pages/LoginPage";
import { AppShell } from "./components/layout/AppShell";

function Root() {
  const { t, mode, toggle } = useTheme();
  const user       = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const logout     = useAuthStore((s) => s.logout);

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener("ids:sesion-expirada", onExpired);
    return () => window.removeEventListener("ids:sesion-expirada", onExpired);
  }, [logout]);

  if (!user) {
    return (
      <LoginPage
        t={t}
        mode={mode}
        onToggleTheme={toggle}
        onLogin={setSession}
      />
    );
  }

  return <AppShell />;
}

export default function App() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}
