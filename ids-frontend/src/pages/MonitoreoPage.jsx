import { useState, useEffect } from "react";
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { monitorService } from "../services/api";


function BotonRefresh({ onClick, t, s }) {
  return (
    <button onClick={onClick} style={{ ...s.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>
      <NavIcon name="refresh" size={12} /> Recargar
    </button>
  );
}

function GraficoTrafico({ datos, dataKey, nombre, color, gradId, t, hayDatos }) {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <AreaChart data={datos} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.7} />
              <stop offset="95%" stopColor={color} stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
          <XAxis dataKey="ts" tick={{ fontSize: 11, fill: t.text3 }} />
          <YAxis tick={{ fontSize: 11, fill: t.text3 }} allowDecimals={false}
                 domain={[0, hayDatos ? "auto" : 1000]}
                 label={{ value: "Flujos", angle: -90, position: "insideLeft", fill: t.text3, fontSize: 11 }} />
          <Tooltip contentStyle={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }} />
          <Area type="basis" dataKey={dataKey} name={nombre} stroke={color}
                fill={`url(#${gradId})`} strokeWidth={2.5}
                isAnimationActive={true} animationDuration={800} animationEasing="ease-in-out"
                dot={false} activeDot={{ r: 4 }} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Gráfico de tráfico anómalo: dos áreas superpuestas.
//  - rojo  = ataques reales (confirmados / conservados por firma)
//  - azul  = falsos positivos que el ML descartó
function GraficoAnomalo({ datos, t, hayDatos }) {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <AreaChart data={datos} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gAtaque" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#dc2626" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gDescartado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
          <XAxis dataKey="ts" tick={{ fontSize: 11, fill: t.text3 }} />
          <YAxis tick={{ fontSize: 11, fill: t.text3 }} allowDecimals={false}
                 domain={[0, hayDatos ? "auto" : 4]}
                 label={{ value: "Flujos", angle: -90, position: "insideLeft", fill: t.text3, fontSize: 11 }} />
          <Tooltip contentStyle={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {/* Azul (descartados) primero, rojo (ataques) encima para que se distingan */}
          <Area type="basis" dataKey="descartados" name="Descartados (falsos positivos)" stroke="#2563eb"
                fill="url(#gDescartado)" strokeWidth={2}
                isAnimationActive={true} animationDuration={800} animationEasing="ease-in-out"
                dot={false} activeDot={{ r: 4 }} connectNulls />
          <Area type="basis" dataKey="maliciosos" name="Ataques" stroke="#dc2626"
                fill="url(#gAtaque)" strokeWidth={2.5}
                isAnimationActive={true} animationDuration={800} animationEasing="ease-in-out"
                dot={false} activeDot={{ r: 4 }} connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PageMonitoreo({ t }) {
  const s = useStyles(t);
  const [series, setSeries]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [segmento, setSegmento] = useState("todos");   // filtro de segmento
  const [sensores, setSensores] = useState([]);        // estado de cada sensor

  const cargarTrafico = async () => {
    // Si el fetch falla, NO vaciamos el gráfico: conservamos los datos previos
    // para que no parpadee. Solo actualizamos cuando llegan datos válidos.
    try {
      const data = (await monitorService.getStats(5, segmento)).data.series;
      if (Array.isArray(data)) setSeries(data);
    } catch { /* mantener datos previos */ }
    finally { setLoading(false); }   // tras la 1ª carga, loading queda false para siempre
  };
  const cargarSensores = async () => {
    try {
      const data = (await monitorService.getSensores()).data.sensores;
      if (Array.isArray(data)) setSensores(data);
    } catch { /* mantener datos previos */ }
  };
  const cargarTodo = () => { cargarTrafico(); cargarSensores(); };

  useEffect(() => {
    cargarTodo();
    if (!autoRefresh) return;
    // 3s con granularidad de 10s en el backend: la curva avanza seguido y fluido.
    const iv = setInterval(cargarTodo, 3000);
    return () => clearInterval(iv);
  }, [autoRefresh, segmento]);

  const totalNormal = series.reduce((a, p) => a + (p.normales || 0), 0);
  const totalMalicioso = series.reduce((a, p) => a + (p.maliciosos || 0), 0);
  const totalPaquetes = series.reduce((a, p) => a + (p.packets || 0), 0);

  const hayDatos = series.length > 0;
  const datosGrafico = hayDatos
    ? series
    : [{ ts: "", normales: 0, maliciosos: 0, descartados: 0, packets: 0 },
       { ts: "", normales: 0, maliciosos: 0, descartados: 0, packets: 0 }];


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Selector de segmento */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: t.text2, fontWeight: 600 }}>Segmento:</span>
          <select value={segmento} onChange={(e) => setSegmento(e.target.value)}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6,
                     background: t.card, color: t.text, border: `1px solid ${t.border}` }}>
            <option value="todos">Todos</option>
            <option value="datos">Red de Datos</option>
            <option value="contable">Contabilidad</option>
            <option value="wifi">WiFi</option>
            <option value="dmz">Producción (DMZ)</option>
            <option value="prodv2">Producción V2</option>
            <option value="riesgos">Riesgos</option>
          </select>
        </div>
        <button onClick={() => setAutoRefresh((v) => !v)}
          style={{ ...s.btn(autoRefresh ? "primary" : "ghost"), fontSize: 12 }}>
          {autoRefresh ? "● En vivo" : "○ Pausado"}
        </button>
      </div>

      {/* Estado de sensores por segmento */}
      <div style={{ ...s.card, padding: "10px 14px" }}>
        <div style={{ fontSize: 12, color: t.text2, fontWeight: 600, marginBottom: 8 }}>
          Sensores por segmento
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {sensores.length === 0 && (
            <span style={{ fontSize: 12, color: t.text3 }}>Sin sensores reportando aún.</span>
          )}
          {sensores.map((sen) => (
            <span key={sen.segmento} title={`interfaz: ${sen.interfaz || "?"}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11,
                fontWeight: 600, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap",
                color: sen.activo ? "#16a34a" : t.text3,
                background: sen.activo ? "#16a34a18" : `${t.text3}14`,
              }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%",
                background: sen.activo ? "#16a34a" : t.text3, display: "inline-block" }} />
              {sen.segmento} · {sen.activo ? "activo" : "inactivo"}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
        <MetricCard label="Flujos normales"   value={totalNormal}    color={t.ok}     t={t} />
        <MetricCard label="Flujos maliciosos" value={totalMalicioso} color={t.danger} t={t} />
        <MetricCard label="Paquetes (1h)"     value={totalPaquetes}  color={t.accent} t={t} />
      </div>

      {/* Tráfico NORMAL y ANÓMALO  */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={s.card}>
          <SectionHeader title="Tráfico normal en tiempo real" badge="5 min" badgeVariant="live" t={t}>
            <BotonRefresh onClick={cargarTrafico} t={t} s={s} />
          </SectionHeader>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: t.text3, fontSize: 13 }}>Cargando...</div>
          ) : (
            <GraficoTrafico datos={datosGrafico} dataKey="normales" nombre="Tráfico normal"
              color="#16a34a" gradId="gNormal" t={t} hayDatos={hayDatos} />
          )}
        </div>

        <div style={s.card}>
          <SectionHeader title="Tráfico anómalo en tiempo real" badge="5 min" badgeVariant="danger" t={t}>
            <BotonRefresh onClick={cargarTrafico} t={t} s={s} />
          </SectionHeader>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: t.text3, fontSize: 13 }}>Cargando...</div>
          ) : (
            <GraficoAnomalo datos={datosGrafico} t={t} hayDatos={hayDatos} />
          )}
        </div>
      </div>
    </div>
  );
}
