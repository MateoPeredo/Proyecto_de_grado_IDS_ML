import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar }  from "./Topbar";
import { useTheme } from "../../context/ThemeContext";
import { useAuthStore } from "../../store/authStore";
import { useAlerts } from "../../hooks/useAlerts";

import { PageDashboard } from "../../pages/DashboardPage";
import { PageMonitoreo } from "../../pages/MonitoreoPage";
import { PageAlertas }   from "../../pages/AlertasPage";
import { PageNotificaciones } from "../../pages/NotificacionesPage";
import { PageReglas }    from "../../pages/ReglasFirmasPage";
import { PageLogs }      from "../../pages/LogsPage";
import { PageML }        from "../../pages/MLModeloPage";
import { PageUsuarios }  from "../../pages/UsuariosPage";
import { PageConfig }    from "../../pages/ConfigPage";

export function AppShell() {
  const { t, mode, toggle } = useTheme();
  const logout               = useAuthStore((s) => s.logout);
  const user                 = useAuthStore((s) => s.user);
  const role                 = useAuthStore((s) => s.role);
  const { alerts, acknowledge, acknowledgeAll, activeCount } = useAlerts();

  const [page,      setPage]      = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const pages = {
    dashboard: <PageDashboard alerts={alerts} t={t} />,
    monitoreo: <PageMonitoreo t={t} />,
    alertas:   <PageAlertas  alerts={alerts} onAck={acknowledge} onAckAll={acknowledgeAll} t={t} />,
    notif:     <PageNotificaciones t={t} />,
    reglas:    <PageReglas   t={t} />,
    logs:      <PageLogs     t={t} />,
    ml:        <PageML       t={t} />,
    usuarios:  <PageUsuarios t={t} />,
    config:    <PageConfig   t={t} mode={mode} onToggleTheme={toggle} />,
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: t.bg, overflow: "hidden" }}>
      <Sidebar
        t={t}
        page={page}
        onNavigate={setPage}
        activeCount={activeCount}
        collapsed={collapsed}
        user={user}
        role={role}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <Topbar
          t={t}
          page={page}
          mode={mode}
          onToggleTheme={toggle}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onLogout={logout}
        />

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", background: t.bg }}>
          {page === "ml" && role !== "developer" ? (
            <div style={{ padding: 40, textAlign: "center", color: t.text3, fontSize: 14 }}>
              No tienes permiso para acceder a esta sección.<br />
              Solo el rol Desarrollador puede ver el modelo de ML.
            </div>
          ) : (
            pages[page]
          )}
        </div>

        {/* Footer */}
        <div style={{
          background: t.bg2,
          borderTop: `0.5px solid ${t.border}`,
          padding: "5px 20px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: t.text3,
          fontFamily: "monospace",
        }}>
        </div>
      </div>
    </div>
  );
}
