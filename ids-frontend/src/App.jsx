import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { useAuthStore } from "./store/authStore";
import { LoginPage } from "./pages/LoginPage";
import { AppShell } from "./components/layout/AppShell";

function Root() {
  const { t, mode, toggle } = useTheme();
  const user  = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);

  if (!user) {
    return (
      <LoginPage
        t={t}
        mode={mode}
        onToggleTheme={toggle}
        onLogin={login}
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
