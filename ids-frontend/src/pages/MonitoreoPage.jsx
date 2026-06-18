import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, SectionHeader } from "../components/ui/SharedUI";
import { monitorService } from "../services/api";

// Monitoreo de tráfico en tiempo real, alimentado por ClickHouse.
// Gráfico de área: tráfico normal (verde) vs malicioso (rojo) sobre el tiempo.
// Mientras el motor de captura del IDS no envíe datos, se muestra vacío.
export function PageMonitoreo({ t }) {
  const s = useStyles(t);
  const [series, setSeries]   = useState([]);
  const [protos, setProtos]   = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    try {
      const [stats, protocols] = await Promise.all([
        monitorService.getStats(60),
        monitorService.getProtocols(24),
      ]);
      setSeries(stats.data.series || []);
      setProtos(protocols.data.protocols || []);
    } catch {
      setSeries([]); setProtos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    const iv = setInterval(cargar, 3000); // refresco cada 3s (casi en vivo)
    return () => clearInterval(iv);
  }, []);

  // Totales para las tarjetas
  const totalNormal = series.reduce((a, p) => a + (p.normales || 0), 0);
  const totalMalicioso = series.reduce((a, p) => a + (p.maliciosos || 0), 0);
  const totalPaquetes = series.reduce((a, p) => a + (p.packets || 0), 0);

  // Si no hay datos, mostrar una línea plana (ceros) para que el gráfico
  // siga visible con sus ejes y leyenda, en vez de desaparecer.
  const datosGrafico = series.length > 0
    ? series
    : [
        { ts: "", normales: 0, maliciosos: 0, packets: 0 },
        { ts: "", normales: 0, maliciosos: 0, packets: 0 },
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
        <MetricCard label="Flujos normales"   value={totalNormal}    color={t.ok}     t={t} />
        <MetricCard label="Flujos maliciosos" value={totalMalicioso} color={t.danger} t={t} />
        <MetricCard label="Paquetes (1h)"     value={totalPaquetes}  color={t.accent} t={t} />
        <MetricCard label="Protocolos"        value={protos.length}  color={t.warn}   t={t} />
      </div>

      {/* Gráfico de tráfico en tiempo real */}
      <div style={s.card}>
        <SectionHeader title="Captura de tráfico en tiempo real" badge="1 min" t={t} />
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: t.text3, fontSize: 13 }}>Cargando...</div>
        ) : (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <AreaChart data={datosGrafico} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gNormal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="gMalicioso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                <XAxis dataKey="ts" tick={{ fontSize: 11, fill: t.text3 }} />
                <YAxis tick={{ fontSize: 11, fill: t.text3 }} domain={[0, series.length > 0 ? "auto" : 1000]} label={{ value: "Flujos", angle: -90, position: "insideLeft", fill: t.text3, fontSize: 11 }} />
                <Tooltip contentStyle={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="normales"   name="Tráfico normal"    stroke="#16a34a" fill="url(#gNormal)"    strokeWidth={2} />
                <Area type="monotone" dataKey="maliciosos" name="Tráfico malicioso" stroke="#dc2626" fill="url(#gMalicioso)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Distribución por protocolo */}
      <div style={s.card}>
        <SectionHeader title="Distribución por protocolo" t={t} />
        {protos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: t.text3, fontSize: 13 }}>
            Sin datos de protocolo aún.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {protos.map((p) => (
              <div key={p.protocol} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 60, fontSize: 12, fontFamily: "monospace", color: t.text2 }}>{p.protocol}</span>
                <span style={{ fontSize: 12, color: t.text3 }}>{p.packets.toLocaleString()} paquetes</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
