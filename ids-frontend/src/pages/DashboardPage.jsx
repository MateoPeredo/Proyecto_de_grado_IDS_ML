import { useStyles } from "../hooks/useStyles";
import { MetricCard, SectionHeader } from "../components/ui/SharedUI";

// Dashboard general. Combina datos reales (alertas desde MySQL) con métricas
// que llegarán cuando el motor del IDS y ClickHouse estén activos.
export function PageDashboard({ alerts, t }) {
  const s = useStyles(t);

  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const critCount    = activeAlerts.filter((a) => a.severity === "critical").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <MetricCard label="Alertas activas"  value={activeAlerts.length} color={t.accent} t={t} />
        <MetricCard label="Críticas"         value={critCount}           color={t.danger} t={t} />
        <MetricCard label="Tráfico (CH)"     value="—"                   color={t.ok}     t={t} />
        <MetricCard label="Estado modelo ML" value="—"                   color={t.warn}   t={t} />
      </div>

      <div style={s.card}>
        <SectionHeader title="Resumen del sistema" t={t} />
        <div style={{ textAlign: "center", padding: "40px 16px", color: t.text3, fontSize: 13 }}>
          {alerts.length === 0
            ? "Sin alertas aún. El panel se poblará cuando el motor de detección del IDS esté activo."
            : `${alerts.length} alertas registradas. El resto de métricas (tráfico, modelo) se mostrarán cuando esos módulos estén activos.`}
        </div>
      </div>
    </div>
  );
}
