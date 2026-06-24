import { useState, useEffect } from "react";
import {
  BarChart, Bar, Cell, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { monitorService } from "../services/api";

const COLORES = ["#3b82f6", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777"];

function BotonRefresh({ onClick, t, s }) {
  return (
    <button onClick={onClick} style={{ ...s.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>
      <NavIcon name="refresh" size={12} /> Recargar
    </button>
  );
}

export function PageDashboard({ alerts, t }) {
  const s = useStyles(t);
  const [resumen, setResumen]     = useState(null);
  const [tipos, setTipos]         = useState([]);
  const [atacantes, setAtacantes] = useState([]);
  const [ml, setMl]               = useState(null);

  const cargarResumen    = async () => { try { setResumen((await monitorService.getResumen()).data); } catch {} };
  const cargarTipos      = async () => { try { setTipos((await monitorService.getTiposAtaque()).data.tipos || []); } catch {} };
  const cargarAtacantes  = async () => { try { setAtacantes((await monitorService.getTopAtacantes()).data.atacantes || []); } catch {} };
  const cargarML         = async () => { try { setMl((await monitorService.getVerificacionML()).data); } catch {} };

  const cargarTodo = () => { cargarResumen(); cargarTipos(); cargarAtacantes(); cargarML(); };

  useEffect(() => { cargarTodo(); }, []);

  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const critCount    = activeAlerts.filter((a) => a.severity === "critical").length;

  const datosML = ml && (ml.confirmadas_ml > 0 || ml.solo_firma > 0) ? [
    { name: "Confirmadas por ML", value: ml.confirmadas_ml, color: "#dc2626" },
    { name: "Solo firma",         value: ml.solo_firma,     color: "#d97706" },
  ].filter((d) => d.value > 0) : [{ name: "Sin datos", value: 1, color: t.border }];

  const tiposGrafico = tipos.length > 0 ? tipos : [{ nombre: "—", count: 0 }];
  const atacantesGrafico = atacantes.length > 0 ? atacantes : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={cargarTodo} style={{ ...s.btn("primary"), fontSize: 12 }}>
          <NavIcon name="refresh" size={13} /> Recargar todo
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <MetricCard label="Alertas activas"  value={activeAlerts.length} color={t.accent} t={t} />
        <MetricCard label="Críticas"         value={critCount}           color={t.danger} t={t} />
        <MetricCard label="Tráfico malicioso (24h)" value={resumen ? `${resumen.pct_malicioso}%` : "0%"} color={t.danger} t={t} />
        <MetricCard label="Paquetes (24h)"   value={resumen ? resumen.paquetes_24h.toLocaleString() : "0"} color={t.ok} t={t} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
        <div style={s.card}>
          <SectionHeader title="Tipos de ataque detectados" t={t}>
            <BotonRefresh onClick={cargarTipos} t={t} s={s} />
          </SectionHeader>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={tiposGrafico} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: t.text3 }} allowDecimals={false} />
                <YAxis type="category" dataKey="nombre" width={110} tick={{ fontSize: 10, fill: t.text3 }} />
                <Tooltip contentStyle={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" name="Alertas" radius={[0, 6, 6, 0]}>
                  {tiposGrafico.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {tipos.length === 0 && <p style={{ textAlign: "center", fontSize: 11, color: t.text3, margin: 0 }}>Sin alertas registradas aún.</p>}
        </div>

        <div style={s.card}>
          <SectionHeader title="Verificación del modelo ML" badge="double-check" t={t}>
            <BotonRefresh onClick={cargarML} t={t} s={s} />
          </SectionHeader>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={datosML} dataKey="value" nameKey="name" cx="50%" cy="50%"
                     outerRadius={90} label={(e) => `${e.name}: ${e.value}`} labelLine={false}
                     style={{ fontSize: 11 }}>
                  {datosML.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {(!ml || (ml.confirmadas_ml === 0 && ml.solo_firma === 0)) &&
            <p style={{ textAlign: "center", fontSize: 11, color: t.text3, margin: 0 }}>Sin verificaciones aún.</p>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
        <div style={s.card}>
          <SectionHeader title="Top IPs atacantes" t={t}>
            <BotonRefresh onClick={cargarAtacantes} t={t} s={s} />
          </SectionHeader>
          {atacantesGrafico.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: t.text3, fontSize: 13 }}>
              Sin IPs atacantes registradas aún.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {atacantesGrafico.map((a, i) => {
                const max = atacantesGrafico[0].count || 1;
                return (
                  <div key={a.ip} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 110, fontSize: 11, fontFamily: "monospace", color: t.text2 }}>{a.ip}</span>
                    <div style={{ flex: 1, background: t.border, borderRadius: 4, height: 18, overflow: "hidden" }}>
                      <div style={{ width: `${(a.count / max) * 100}%`, height: "100%",
                                    background: COLORES[i % COLORES.length], borderRadius: 4 }} />
                    </div>
                    <span style={{ width: 36, textAlign: "right", fontSize: 12, color: t.text2 }}>{a.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={s.card}>
          <SectionHeader title="Resumen de tráfico (24h)" t={t}>
            <BotonRefresh onClick={cargarResumen} t={t} s={s} />
          </SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 4px" }}>
            <FilaResumen label="Flujos normales"   valor={resumen ? resumen.flujos_normales_24h.toLocaleString() : "0"}   color={t.ok} t={t} />
            <FilaResumen label="Flujos maliciosos" valor={resumen ? resumen.flujos_maliciosos_24h.toLocaleString() : "0"} color={t.danger} t={t} />
            <FilaResumen label="% malicioso"        valor={resumen ? `${resumen.pct_malicioso}%` : "0%"} color={t.warn} t={t} />
            <FilaResumen label="Protocolos activos" valor={resumen ? resumen.protocolos_activos : 0} color={t.accent} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilaResumen({ label, valor, color, t }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderBottom: `1px solid ${t.border}`, paddingBottom: 10 }}>
      <span style={{ fontSize: 13, color: t.text2 }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color }}>{valor}</span>
    </div>
  );
}
