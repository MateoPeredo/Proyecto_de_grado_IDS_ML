import { useState } from "react";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, MlBar, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";

const METRICS = [
  { label: "Exactitud (Accuracy)",  value: 96.8, color: "#16a34a" },
  { label: "Precisión (Precision)", value: 95.1, color: "#3b82f6" },
  { label: "Recall (Sensibilidad)", value: 93.4, color: "#7c3aed" },
  { label: "F1-Score",              value: 94.2, color: "#d97706" },
];

const FEATURES = [
  { name: "pkt_rate",          imp: 18.3 },
  { name: "syn_flag_ratio",    imp: 14.7 },
  { name: "dst_port_entropy",  imp: 12.1 },
  { name: "payload_size_avg",  imp: 10.8 },
  { name: "flow_duration",     imp:  9.4 },
  { name: "ack_rst_ratio",     imp:  7.2 },
  { name: "bytes_per_pkt",     imp:  6.8 },
  { name: "inter_pkt_time",    imp:  5.9 },
];

const CONFUSION = [
  { val: 1842, label: "Verdadero Positivo", color: "#16a34a", bg: "#f0fdf4" },
  { val: 89,   label: "Falso Positivo",     color: "#dc2626", bg: "#fef2f2" },
  { val: 127,  label: "Falso Negativo",     color: "#d97706", bg: "#fffbeb" },
  { val: 9421, label: "Verdadero Negativo", color: "#2563eb", bg: "#eff6ff" },
];

export function PageML({ t }) {
  const s = useStyles(t);
  const [progress,    setProgress]    = useState(0);
  const [retraining,  setRetraining]  = useState(false);

  const retrain = () => {
    setRetraining(true);
    setProgress(0);
    const iv = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(iv); setRetraining(false); return 0; }
        return p + 4;
      });
    }, 150);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        <MetricCard label="Modelo"     value="RF-v3"   sub="Random Forest"   color={t.accent} t={t} />
        <MetricCard label="Árboles"    value="47"      sub="max_depth=12"     color={t.text}   t={t} />
        <MetricCard label="Features"   value="23"      sub="TCP/IP + stats"   color={t.text}   t={t} />
        <MetricCard label="Inferencia" value="0.8ms"   sub="promedio"         color={t.ok}     t={t} />
        <MetricCard label="Entrenado"  value="hace 3d" sub="45k muestras"     color={t.text2}  t={t} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Metrics + confusion */}
        <div style={s.card}>
          <SectionHeader title="Métricas del modelo" t={t} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {METRICS.map((m) => (
              <MlBar key={m.label} label={m.label} value={m.value} color={m.color} t={t} />
            ))}
          </div>

          <div style={{ marginTop: 18, marginBottom: 8, fontSize: 12, fontWeight: 500, color: t.text }}>
            Matriz de confusión
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {CONFUSION.map((c) => (
              <div key={c.label} style={{ textAlign: "center", padding: "12px 8px", borderRadius: 8, background: c.bg, border: `0.5px solid ${t.border}` }}>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", color: c.color }}>
                  {c.val.toLocaleString()}
                </div>
                <div style={{ fontSize: 9, color: t.text3, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 3 }}>
                  {c.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature importance + retrain */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={s.card}>
            <SectionHeader title="Feature importance" t={t} />
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {FEATURES.map((f) => (
                <div key={f.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontFamily: "monospace", color: t.text }}>{f.name}</span>
                    <span style={{ color: t.text2, fontFamily: "monospace" }}>{f.imp}%</span>
                  </div>
                  <div style={{ height: 5, background: t.bg4, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(f.imp / 20) * 100}%`, background: t.accent, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.card}>
            <SectionHeader title="Reentrenamiento" t={t} />
            {retraining ? (
              <div>
                <div style={{ fontSize: 12, color: t.text2, marginBottom: 8 }}>
                  Entrenando... {progress}%
                </div>
                <div style={{ height: 8, background: t.bg4, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: t.accent, borderRadius: 4, transition: "width 0.2s" }} />
                </div>
                <div style={{ fontSize: 11, color: t.text3, marginTop: 8 }}>
                  Ajustando hiperparámetros · validación cruzada 5-fold
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 12, color: t.text2 }}>
                  Último entrenamiento: hace 3 días · Dataset: 45,000 muestras
                </div>
                <button onClick={retrain} style={{ ...s.btn("primary"), justifyContent: "center" }}>
                  <NavIcon name="refresh" size={14} /> Reentrenar modelo
                </button>
                <button style={{ ...s.btn("default"), justifyContent: "center" }}>
                  <NavIcon name="download" size={14} /> Exportar modelo (.pkl)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
