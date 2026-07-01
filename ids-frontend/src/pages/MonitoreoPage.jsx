import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { monitorService } from "../services/api";

const COLORES_PROTO = ["#3b82f6", "#16a34a", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

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
          <Area type="monotone" dataKey={dataKey} name={nombre} stroke={color}
                fill={`url(#${gradId})`} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PageMonitoreo({ t }) {
  const s = useStyles(t);
  const [series, setSeries]   = useState([]);
  const [protos, setProtos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const cargarTrafico = async () => {
    try { setSeries((await monitorService.getStats(60)).data.series || []); } catch { setSeries([]); }
    finally { setLoading(false); }
  };
  const cargarProtos = async () => {
    try { setProtos((await monitorService.getProtocolosTrafico(1440)).data.protocols || []); } catch { setProtos([]); }
  };
  const cargarTodo = () => { cargarTrafico(); cargarProtos(); };

  useEffect(() => {
    cargarTodo();
    if (!autoRefresh) return;
    const iv = setInterval(cargarTodo, 3000);
    return () => clearInterval(iv);
  }, [autoRefresh]);

  const totalNormal = series.reduce((a, p) => a + (p.normales || 0), 0);
  const totalMalicioso = series.reduce((a, p) => a + (p.maliciosos || 0), 0);
  const totalPaquetes = series.reduce((a, p) => a + (p.packets || 0), 0);

  const hayDatos = series.length > 0;
  const datosGrafico = hayDatos
    ? series
    : [{ ts: "", normales: 0, maliciosos: 0, packets: 0 },
       { ts: "", normales: 0, maliciosos: 0, packets: 0 }];

  const protosGrafico = protos.length > 0 ? protos : [{ protocol: "—", packets: 0, bytes: 0 }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={() => setAutoRefresh((v) => !v)}
          style={{ ...s.btn(autoRefresh ? "primary" : "ghost"), fontSize: 12 }}>
          {autoRefresh ? "● En vivo" : "○ Pausado"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
        <MetricCard label="Flujos normales"   value={totalNormal}    color={t.ok}     t={t} />
        <MetricCard label="Flujos maliciosos" value={totalMalicioso} color={t.danger} t={t} />
        <MetricCard label="Paquetes (1h)"     value={totalPaquetes}  color={t.accent} t={t} />
        <MetricCard label="Protocolos"        value={protos.length}  color={t.warn}   t={t} />
      </div>

      {/* Tráfico NORMAL y ANÓMALO  */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 14 }}>
        <div style={s.card}>
          <SectionHeader title="Tráfico normal en tiempo real" badge="1 min" badgeVariant="live" t={t}>
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
          <SectionHeader title="Tráfico anómalo en tiempo real" badge="1 min" badgeVariant="danger" t={t}>
            <BotonRefresh onClick={cargarTrafico} t={t} s={s} />
          </SectionHeader>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: t.text3, fontSize: 13 }}>Cargando...</div>
          ) : (
            <GraficoTrafico datos={datosGrafico} dataKey="maliciosos" nombre="Tráfico anómalo"
              color="#dc2626" gradId="gMalicioso" t={t} hayDatos={hayDatos} />
          )}
        </div>
      </div>

      <div style={s.card}>
        <SectionHeader title="Distribución por protocolo (24h)" t={t}>
          <BotonRefresh onClick={cargarProtos} t={t} s={s} />
        </SectionHeader>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={protosGrafico} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey="protocol" tick={{ fontSize: 12, fill: t.text3 }} />
              <YAxis tick={{ fontSize: 11, fill: t.text3 }} allowDecimals={false} label={{ value: "Paquetes", angle: -90, position: "insideLeft", fill: t.text3, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="packets" name="Paquetes" radius={[6, 6, 0, 0]}>
                {protosGrafico.map((_, i) => <Cell key={i} fill={COLORES_PROTO[i % COLORES_PROTO.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {protos.length === 0 && <p style={{ textAlign: "center", fontSize: 11, color: t.text3, margin: 0 }}>Sin datos de protocolo aún. Capturá tráfico con el sensor.</p>}
      </div>
    </div>
  );
}
