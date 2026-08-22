import { useState, useEffect } from "react";
import { useStyles } from "../hooks/useStyles";
import { SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { configService, monitorService } from "../services/api";

// Configuración GLOBAL del IDS: parámetros que aplican por igual a todos los
// sensores. La interfaz de captura NO va aquí: cada sensor vigila su propio
// segmento (un bridge/VLAN distinto), así que se define por sensor en el
// despliegue, no de forma global. Esos sensores se muestran más abajo, en
// modo informativo (solo lectura).
const SECTIONS = [
  {
    title: "Motor de detección (firmas)",
    desc: "Parámetros globales que aplican a todos los sensores.",
    fields: [
      { label: "Acción al detectar", key: "deteccion_accion", type: "select",
        options: [
          { value: "solo_alertar",      label: "Solo alertar" },
          { value: "alertar_registrar", label: "Alertar y registrar" },
        ] },
      { label: "Nivel de log", key: "deteccion_log_level", type: "select",
        options: ["debug", "info", "warning", "error"] },
    ],
  },
];

export function PageConfig({ t }) {
  const s = useStyles(t);
  const [cfg,      setCfg]      = useState({});
  const [sensores, setSensores] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");

  // Cargar configuración global y estado de los sensores al montar
  useEffect(() => {
    Promise.all([
      configService.get(),
      monitorService.getSensores().catch(() => ({ data: { sensores: [] } })),
    ])
      .then(([cfgRes, senRes]) => {
        setCfg(cfgRes.data);
        setSensores(senRes.data?.sensores ?? []);
      })
      .catch(() => setError("No se pudo cargar la configuración del backend."))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await configService.save(cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const renderOption = (o) =>
    typeof o === "string"
      ? <option key={o} value={o}>{o}</option>
      : <option key={o.value} value={o.value}>{o.label}</option>;

  if (loading) {
    return <div style={{ padding: 24, color: t.text3, fontSize: 13 }}>Cargando configuración...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Configuración global editable */}
      {SECTIONS.map((sec) => (
        <div key={sec.title} style={s.card}>
          <SectionHeader title={sec.title} t={t} />
          {sec.desc && (
            <div style={{ fontSize: 12, color: t.text3, marginBottom: 12, marginTop: -6 }}>{sec.desc}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {sec.fields.map((f) => (
              <div key={f.key}>
                <label style={s.label}>{f.label}</label>
                <select
                  style={s.select}
                  value={cfg[f.key] ?? ""}
                  onChange={(e) => setCfg((p) => ({ ...p, [f.key]: e.target.value }))}
                >
                  {f.options.map(renderOption)}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Guardar (solo para la config global) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ ...s.btn("primary"), padding: "10px 28px", opacity: saving ? 0.7 : 1 }}>
          <NavIcon name="check" size={14} />
          {saving ? "Guardando..." : saved ? "Guardado" : "Guardar configuración"}
        </button>
        {saved && <span style={{ fontSize: 12, color: t.ok }}>Configuración guardada.</span>}
        {error && <span style={{ fontSize: 12, color: t.danger }}>{error}</span>}
      </div>

      {/* Sensores por segmento (informativo, solo lectura) */}
      <div style={s.card}>
        <SectionHeader title="Sensores por segmento" t={t} />
        <div style={{ fontSize: 12, color: t.text3, marginBottom: 12, marginTop: -6 }}>
          Cada segmento de la red (VLAN en producción, bridge en el laboratorio) es
          vigilado por un sensor dedicado que captura en modo promiscuo. La interfaz
          de cada sensor se define en su despliegue. Esta vista es informativa.
        </div>

        {sensores.length === 0 ? (
          <div style={{ fontSize: 13, color: t.text3, padding: "8px 0" }}>
            No hay sensores reportando estado. Levantá los sensores para verlos aquí.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
            {sensores.map((sen) => (
              <div key={sen.segmento} style={{ ...s.metric, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, textTransform: "capitalize" }}>
                    {sen.segmento}
                  </div>
                  <div style={{ fontSize: 11, color: t.text3, fontFamily: "monospace", marginTop: 2 }}>
                    {sen.interfaz || "—"}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px",
                  padding: "3px 9px", borderRadius: 5,
                  background: sen.activo ? t.okBg : t.bg4,
                  color:      sen.activo ? t.ok   : t.text3,
                  border: `0.5px solid ${sen.activo ? t.ok : t.border2}`,
                }}>
                  {sen.activo ? "activo" : "inactivo"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
