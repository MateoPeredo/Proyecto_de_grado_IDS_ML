import { useStyles } from "../hooks/useStyles";
import { MetricCard, SectionHeader } from "../components/ui/SharedUI";

// Monitoreo de tráfico en tiempo real. Los datos vendrán de ClickHouse (series
// temporales) una vez que el motor de captura del IDS esté activo. Sin simulaciones.
export function PageMonitoreo({ t }) {
  const s = useStyles(t);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        <MetricCard label="Paquetes/s"    value="—" color={t.accent} t={t} />
        <MetricCard label="Tráfico"       value="—" color={t.ok}     t={t} />
        <MetricCard label="Conexiones"    value="—" color={t.warn}   t={t} />
        <MetricCard label="Alertas/min"   value="—" color={t.danger} t={t} />
      </div>

      <div style={s.card}>
        <SectionHeader title="Tráfico en vivo" t={t} />
        <div style={{ textAlign: "center", padding: "48px 16px", color: t.text3, fontSize: 13 }}>
          Sin datos aún.<br />
          El monitoreo de tráfico se mostrará aquí cuando el motor de captura del IDS esté activo
          y enviando métricas a ClickHouse.
        </div>
      </div>
    </div>
  );
}
