import { useState } from "react";
import { useStyles } from "../hooks/useStyles";
import { SevBadge, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";

// Página de alertas conectada al backend (los datos vienen del hook useAlerts -> MySQL).
// Mientras el motor del IDS no genere alertas, la tabla aparece vacía.
export function PageAlertas({ alerts, onAck, onAckAll, t }) {
  const s = useStyles(t);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = alerts.filter((a) => {
    if (filter === "active" && a.acknowledged) return false;
    if (filter !== "all" && filter !== "active" && a.severity !== filter) return false;
    const q = search.toLowerCase();
    if (q) {
      const hay = `${a.source_ip ?? ""} ${a.dest_ip ?? ""} ${a.signature_name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all:      alerts.length,
    active:   alerts.filter((a) => !a.acknowledged).length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    high:     alerts.filter((a) => a.severity === "high").length,
  };

  const filterBtns = [
    { key: "all",      label: "Todas"    },
    { key: "active",   label: "Activas"  },
    { key: "critical", label: "Críticas" },
    { key: "high",     label: "Altas"    },
  ];

  const fmtTime = (ts) => {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          style={{ ...s.input, maxWidth: 240 }}
          placeholder="Buscar IP, firma..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {filterBtns.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{ ...s.btn(filter === key ? "primary" : "ghost"), fontSize: 12, padding: "6px 12px" }}
            >
              {label} ({counts[key]})
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={s.badge(counts.active > 0 ? "danger" : "live")}>
            {counts.active} sin resolver
          </span>
          {counts.active > 0 && (
            <button onClick={onAckAll} style={{ ...s.btn("ghost"), fontSize: 12, padding: "5px 12px" }}>
              <NavIcon name="check" size={13} /> ACK todos
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div style={s.card}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 680 }}>
            <thead>
              <tr>
                {["Hora", "IP Origen", "IP Destino", "Firma", "Protocolo", "Detectado por", "Severidad", "Estado", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.6px", color: t.text3, padding: "0 10px 10px 0", fontWeight: 500, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} style={{ opacity: a.acknowledged ? 0.4 : 1, transition: "opacity 0.3s" }}>
                  <td style={{ padding: "8px 10px 8px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: t.text2, whiteSpace: "nowrap" }}>{fmtTime(a.timestamp)}</td>
                  <td style={{ padding: "8px 10px 8px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: t.text }}>{a.source_ip ?? "—"}</td>
                  <td style={{ padding: "8px 10px 8px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: t.text2 }}>{a.dest_ip ?? "—"}</td>
                  <td style={{ padding: "8px 10px 8px 0", borderBottom: `0.5px solid ${t.border}`, color: t.text }}>{a.signature_name}</td>
                  <td style={{ padding: "8px 10px 8px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: t.text3 }}>{a.protocol ?? "—"}</td>
                  <td style={{ padding: "8px 10px 8px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: t.text3 }}>{a.detected_by}</td>
                  <td style={{ padding: "8px 10px 8px 0", borderBottom: `0.5px solid ${t.border}` }}><SevBadge sev={a.severity} t={t} /></td>
                  <td style={{ padding: "8px 10px 8px 0", borderBottom: `0.5px solid ${t.border}` }}>
                    <span style={s.badge(a.acknowledged ? "default" : "danger")}>
                      {a.acknowledged ? "Resuelta" : "Activa"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 0", borderBottom: `0.5px solid ${t.border}` }}>
                    {!a.acknowledged && (
                      <button onClick={() => onAck(a.id)} style={{ ...s.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>
                        <NavIcon name="check" size={12} /> ACK
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0", color: t.text3, fontSize: 13 }}>
              Sin alertas aún. El motor de detección del IDS las generará cuando esté activo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
