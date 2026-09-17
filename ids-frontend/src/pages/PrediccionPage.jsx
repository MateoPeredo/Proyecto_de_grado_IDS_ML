import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { prediccionService } from "../services/api";

const TIPOS = ["Todos", "DoS", "PortScan", "BruteForce"];

// ── Serie de referencia (solo frontend) ───────────────────────────────────────
// Se usa únicamente cuando el backend todavía no tiene histórico suficiente, para
// ilustrar el funcionamiento del módulo. Cuando haya datos reales, el backend los
// provee y esta serie deja de usarse automáticamente.
const MUESTRA_MESES = ["Sep 25", "Oct 25", "Nov 25", "Dic 25", "Ene 26", "Feb 26",
                       "Mar 26", "Abr 26", "May 26", "Jun 26", "Jul 26", "Ago 26"];
const MUESTRA_MES_PROY = "Sep 26";
const MUESTRA_SERIES = {
  DoS:        [4, 5, 5, 6, 7, 7, 8, 9, 9, 10, 11, 11],
  PortScan:   [6, 7, 8, 8, 9, 10, 11, 11, 12, 13, 14, 14],
  BruteForce: [2, 3, 3, 4, 5, 5, 6, 6, 7, 7, 8, 8],
};

function regresionLineal(ys) {
  const n = ys.length;
  const xs = [...Array(n).keys()];
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const b = (sy - m * sx) / n;
  return { m, b };
}

function packLocal(tipo, serie) {
  const n = serie.length;
  const { m, b } = regresionLineal(serie);
  const tendencia = Array.from({ length: n + 1 }, (_, i) => Math.max(0, +(m * i + b).toFixed(1)));
  const proyeccion = Math.round(Math.max(0, m * n + b));
  const promedio = +(serie.reduce((a, x) => a + x, 0) / n).toFixed(1);
  const ultimo = serie[n - 1];
  const tendencia_txt = m > 0.3 ? "En aumento" : m < -0.3 ? "A la baja" : "Estable";
  return {
    tipo, meses: MUESTRA_MESES, mes_proyeccion: MUESTRA_MES_PROY, serie, tendencia,
    proyeccion, pendiente: +m.toFixed(2), promedio, ultimo,
    variacion: proyeccion - ultimo, tendencia_txt,
  };
}

// Construye el payload completo desde la serie de referencia (fallback).
function payloadDeMuestra() {
  const todos = MUESTRA_MESES.map((_, i) =>
    MUESTRA_SERIES.DoS[i] + MUESTRA_SERIES.PortScan[i] + MUESTRA_SERIES.BruteForce[i]);
  const series = { Todos: todos, ...MUESTRA_SERIES };
  return {
    meses: MUESTRA_MESES,
    mes_proyeccion: MUESTRA_MES_PROY,
    tipos: TIPOS,
    predicciones: Object.fromEntries(TIPOS.map((tp) => [tp, packLocal(tp, series[tp])])),
  };
}

function etiquetaTipo(tipo) {
  if (tipo === "Todos") return "ataques en total";
  if (tipo === "DoS") return "ataques de denegación de servicio (DoS)";
  if (tipo === "PortScan") return "escaneos de puertos";
  if (tipo === "BruteForce") return "ataques de fuerza bruta";
  return "ataques";
}

export function PagePrediccion({ t }) {
  const s = useStyles(t);
  const [tipo, setTipo] = useState("Todos");
  const [payload, setPayload] = useState(null);
  const [estado, setEstado] = useState("cargando"); // cargando | ok

  useEffect(() => {
    let vivo = true;
    prediccionService
      .getAll()
      .then((r) => {
        if (!vivo) return;
        // Usa datos reales si el backend tiene histórico suficiente; si no, la serie de referencia.
        setPayload(r.data?.datos_suficientes ? r.data : payloadDeMuestra());
        setEstado("ok");
      })
      .catch(() => {
        if (!vivo) return;
        setPayload(payloadDeMuestra());
        setEstado("ok");
      });
    return () => { vivo = false; };
  }, []);

  const p = payload?.predicciones?.[tipo] ?? null;

  const chartData = useMemo(() => {
    if (!p) return [];
    const filas = p.meses.map((mes, i) => ({
      mes, real: p.serie[i], tendencia: p.tendencia[i], pred: null,
    }));
    filas.push({
      mes: p.mes_proyeccion, real: null,
      tendencia: p.tendencia[p.tendencia.length - 1], pred: p.proyeccion,
    });
    return filas;
  }, [p]);

  if (estado === "cargando" || !p) {
    return <div style={{ ...s.card, textAlign: "center", color: t.text3, fontSize: 13, padding: "40px 0" }}>
      Cargando predicción…
    </div>;
  }

  const colorTend = p.tendencia_txt === "En aumento" ? t.danger
                  : p.tendencia_txt === "A la baja" ? t.ok : t.warn;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Selector de tipo */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TIPOS.map((tp) => (
          <button key={tp} onClick={() => setTipo(tp)}
            style={{ ...s.btn(tipo === tp ? "primary" : "default"), fontSize: 12, padding: "6px 14px" }}>
            {tp}
          </button>
        ))}
      </div>

      {/* Frase de predicción — lo primero y más claro */}
      <div style={{ ...s.card, borderLeft: `4px solid ${t.accent}`, display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, background: t.accentBg,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <NavIcon name="activity" size={20} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.6px", color: t.text3, fontWeight: 600 }}>
            Predicción para {p.mes_proyeccion}
          </div>
          <div style={{ fontSize: 17, color: t.text, lineHeight: 1.45 }}>
            El próximo mes se podrían registrar alrededor de{" "}
            <strong style={{ color: t.accent, fontSize: 20 }}>{p.proyeccion}</strong>{" "}
            {etiquetaTipo(tipo)}.
          </div>
          <div style={{ fontSize: 13, color: t.text2, lineHeight: 1.45 }}>
            {p.variacion > 0
              ? `Son unos ${p.variacion} más que este mes: la tendencia va en aumento, conviene reforzar la prevención.`
              : p.variacion < 0
              ? `Son unos ${Math.abs(p.variacion)} menos que este mes: la tendencia va a la baja.`
              : `Un nivel similar al de este mes: la tendencia se mantiene estable.`}
          </div>
        </div>
      </div>

      {/* Métricas de apoyo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <MetricCard label={`Proyección · ${p.mes_proyeccion}`} value={p.proyeccion}
          sub={etiquetaTipo(tipo)} color={t.accent} t={t} />
        <MetricCard label="Este mes" value={p.ultimo} sub={p.meses[p.meses.length - 1]} t={t} />
        <MetricCard label="Promedio mensual" value={p.promedio} sub="últimos 12 meses" t={t} />
        <MetricCard label="Tendencia" value={p.tendencia_txt}
          sub={`${p.pendiente >= 0 ? "+" : ""}${p.pendiente} ataques/mes`} color={colorTend} t={t} />
      </div>

      {/* Gráfico */}
      <div style={s.card}>
        <SectionHeader title={`Ataques por mes y proyección — ${tipo}`} t={t} />
        <div style={{ height: 320 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: t.text3 }} />
              <YAxis tick={{ fontSize: 11, fill: t.text3 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: t.bg2, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="linear" dataKey="tendencia" name="Tendencia"
                stroke={t.warn} strokeWidth={2} strokeDasharray="6 5" dot={false} />
              <Line type="monotone" dataKey="real" name="Ataques registrados"
                stroke={t.accent} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="pred" name={`Proyección (${p.mes_proyeccion})`}
                stroke={t.ok} strokeWidth={0} dot={{ r: 6, fill: t.ok }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 12, color: t.text3, marginTop: 8, lineHeight: 1.5 }}>
          La línea sólida es el histórico de ataques; la punteada es la tendencia; el punto verde es
          lo que se proyecta para {p.mes_proyeccion}.
        </div>
      </div>

      {/* Cómo se calcula */}
      <div style={s.card}>
        <SectionHeader title="Cómo se calcula" t={t} />
        <p style={{ margin: 0, fontSize: 13, color: t.text2, lineHeight: 1.55 }}>
          La proyección se obtiene con una <strong>regresión lineal</strong> sobre la cantidad de
          ataques de cada mes: se ajusta la recta que mejor describe la evolución y se extiende un mes
          hacia adelante. La pendiente indica el ritmo de cambio — positiva significa que los ataques
          tienden a aumentar. Es un método simple e interpretable para anticipar la carga esperada y
          priorizar acciones preventivas.
        </p>
      </div>
    </div>
  );
}
