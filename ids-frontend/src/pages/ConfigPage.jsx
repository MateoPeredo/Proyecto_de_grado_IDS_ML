import { useState, useEffect } from "react";
import { useStyles } from "../hooks/useStyles";
import { SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { configService } from "../services/api";

// Secciones de configuración (solo lo referente al IDS).
// Cada campo mapea a una clave del backend (tabla config en MySQL).
const SECTIONS = [
  {
    title: "Captura de red",
    fields: [
      { label: "Interfaz de red", key: "captura_interfaz", type: "select", options: ["eth0", "eth1", "wlan0", "lo"] },
      { label: "Modo de captura", key: "captura_modo",      type: "select", options: ["promiscuo", "normal"]        },
    ],
  },
  {
    title: "Motor de detección (firmas)",
    fields: [
      { label: "Acción al detectar", key: "deteccion_accion",    type: "select",
        options: [
          { value: "solo_alertar",       label: "Solo alertar" },
          { value: "alertar_registrar",  label: "Alertar y registrar" },
        ] },
      { label: "Nivel de log", key: "deteccion_log_level", type: "select",
        options: ["debug", "info", "warning", "error"] },
    ],
  },
];

export function PageConfig({ t, mode, onToggleTheme }) {
  const s = useStyles(t);
  const [cfg,     setCfg]     = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  // Cargar la configuración real desde el backend al montar
  useEffect(() => {
    configService.get()
      .then((res) => setCfg(res.data))
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

  // Normaliza opciones: pueden ser strings simples o {value,label}
  const renderOption = (o) =>
    typeof o === "string"
      ? <option key={o} value={o}>{o}</option>
      : <option key={o.value} value={o.value}>{o.label}</option>;

  if (loading) {
    return <div style={{ padding: 24, color: t.text3, fontSize: 13 }}>Cargando configuración...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {SECTIONS.map((sec) => (
        <div key={sec.title} style={s.card}>
          <SectionHeader title={sec.title} t={t} />
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

      {/* Apariencia */}
      <div style={s.card}>
        <SectionHeader title="Apariencia" t={t} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: t.text }}>Tema de la interfaz</span>
          <button onClick={onToggleTheme} style={s.btn("default")}>
            <NavIcon name={mode === "light" ? "moon" : "sun"} size={14} />
            {mode === "light" ? "Cambiar a oscuro" : "Cambiar a claro"}
          </button>
          <span style={{ fontSize: 12, color: t.text3 }}>
            Actualmente: {mode === "light" ? "Claro" : "Oscuro"}
          </span>
        </div>
      </div>

      {/* Guardar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ ...s.btn("primary"), padding: "10px 28px", opacity: saving ? 0.7 : 1 }}>
          <NavIcon name="check" size={14} />
          {saving ? "Guardando..." : saved ? "Guardado" : "Guardar configuración"}
        </button>
        {saved && <span style={{ fontSize: 12, color: t.ok }}>Configuración guardada en MySQL.</span>}
        {error && <span style={{ fontSize: 12, color: t.danger }}>{error}</span>}
      </div>
    </div>
  );
}
