import { useState, useEffect } from "react";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, MlBar, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { mlService } from "../services/api";

// Página del modelo ML conectada al backend real. Mientras no haya un modelo
// entrenado y cargado, muestra estado "sin modelo aún" (sin métricas inventadas).
export function PageML({ t }) {
  const s = useStyles(t);
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    mlService.getMetrics()
      .then((res) => setInfo(res.data))
      .catch(() => setError("No se pudo consultar el estado del modelo."))
      .finally(() => setLoading(false));
  }, []);

  const trained = info?.trained;

  const metrics = [
    { label: "Exactitud (Accuracy)",  key: "accuracy",  color: "#16a34a" },
    { label: "Precisión (Precision)", key: "precision", color: "#3b82f6" },
    { label: "Recall (Sensibilidad)", key: "recall",    color: "#7c3aed" },
    { label: "F1-Score",              key: "f1",        color: "#d97706" },
  ];

  if (loading) {
    return <div style={{ padding: 24, color: t.text3, fontSize: 13 }}>Consultando estado del modelo...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <MetricCard label="Modelo"  value={info?.model ?? "—"}            color={t.accent} t={t} />
        <MetricCard label="Estado"  value={trained ? "Entrenado" : "Sin entrenar"} color={trained ? t.ok : t.text2} t={t} />
      </div>

      {error && <div style={{ fontSize: 12, color: t.danger }}>{error}</div>}

      <div style={s.card}>
        <SectionHeader title="Métricas del modelo" t={t} />
        {trained ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {metrics.map((m) => (
              <MlBar key={m.key} label={m.label} value={(info[m.key] ?? 0) * 100} color={m.color} t={t} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 16px", color: t.text3, fontSize: 13 }}>
            Sin modelo aún.<br />
            Las métricas aparecerán aquí cuando se entrene y cargue el modelo de Machine Learning.
          </div>
        )}
      </div>
    </div>
  );
}
