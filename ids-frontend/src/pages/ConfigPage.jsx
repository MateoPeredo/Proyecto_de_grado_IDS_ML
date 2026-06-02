import { useState } from "react";
import { useStyles } from "../hooks/useStyles";
import { SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";

const SECTIONS = [
  {
    title: "Captura de red",
    fields: [
      { label: "Interfaz de red", key: "iface",  type: "select", options: ["eth0", "eth1", "wlan0", "lo"] },
      { label: "Modo captura",    key: "mode",   type: "select", options: ["promiscuo", "normal"]          },
    ],
  },
  {
    title: "Conexión con backend (FastAPI)",
    fields: [
      { label: "URL API REST",       key: "apiUrl", type: "text", placeholder: "http://localhost:8000"          },
      { label: "WebSocket endpoint", key: "wsUrl",  type: "text", placeholder: "ws://localhost:8000/ws/live"    },
    ],
  },
  {
    title: "Motor de detección",
    fields: [
      { label: "Umbral confianza ML (%)", key: "threshold", type: "number"                                               },
      { label: "Retención de alertas",   key: "retention", type: "select", options: ["7 días","30 días","90 días","1 año"] },
      { label: "Nivel de log",           key: "logLevel",  type: "select", options: ["debug","info","warning","error"]    },
    ],
  },
  {
    title: "Notificaciones",
    fields: [
      { label: "Email alertas críticas",  key: "email",   type: "email", placeholder: "admin@empresa.com"          },
      { label: "Webhook (Slack/Teams)",   key: "webhook", type: "text",  placeholder: "https://hooks.slack.com/..." },
    ],
  },
];

export function PageConfig({ t, mode, onToggleTheme }) {
  const s = useStyles(t);
  const [cfg, setCfg] = useState({
    iface: "eth0", mode: "promiscuo",
    apiUrl: "http://localhost:8000", wsUrl: "ws://localhost:8000/ws/live",
    threshold: 75, retention: "30 días", logLevel: "info",
    email: "", webhook: "",
  });
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {SECTIONS.map((sec) => (
        <div key={sec.title} style={s.card}>
          <SectionHeader title={sec.title} t={t} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {sec.fields.map((f) => (
              <div key={f.key}>
                <label style={s.label}>{f.label}</label>
                {f.type === "select" ? (
                  <select
                    style={s.select}
                    value={cfg[f.key]}
                    onChange={(e) => setCfg((p) => ({ ...p, [f.key]: e.target.value }))}
                  >
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    style={s.input}
                    type={f.type}
                    placeholder={f.placeholder}
                    value={cfg[f.key]}
                    onChange={(e) => setCfg((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Appearance */}
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

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} style={{ ...s.btn("primary"), padding: "10px 28px" }}>
          <NavIcon name="check" size={14} />
          {saved ? "Guardado" : "Guardar configuración"}
        </button>
        {saved && (
          <span style={{ fontSize: 12, color: t.ok }}>
            Configuración guardada correctamente.
          </span>
        )}
      </div>
    </div>
  );
}
