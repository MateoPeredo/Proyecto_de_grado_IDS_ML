import { useState } from "react";
import { useStyles } from "../hooks/useStyles";
import { SevBadge, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";

export function PageAlertas({ alerts, onAck, onAckAll, t }) {
  const s = useStyles(t);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = alerts.filter((a) => {
    if (filter === "active" && a.acknowledged) return false;
    if (filter !== "all" && filter !== "active" && a.sev !== filter) return false;
    const q = search.toLowerCase();
    if (q && !a.src.includes(q) && !a.dst.includes(q) && !a.type.toLowerCase().includes(q)) return false;
    return true;
  });

  const counts = {
    all:    alerts.length,
    active: alerts.filter((a) => !a.acknowledged).length,
    crit:   alerts.filter((a) => a.sev === "crit").length,
    high:   alerts.filter((a) => a.sev === "high").length,
  };

  const filterBtns = [
    { key: "all",    label: "Todas"    },
    { key: "active", label: "Activas"  },
    { key: "crit",   label: "Críticas" },
    { key: "high",   label: "Altas"    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          style={{ ...s.input, maxWidth: 240 }}
          placeholder="Buscar IP, tipo de ataque..."
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

      {/* Table */}
      <div style={s.card}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 680 }}>
            <thead>
              <tr>
                {["Hora", "IP Origen", "IP Destino", "Tipo", "SID", "Severidad", "Conf. ML", "Estado", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.6px", color: t.text3, padding: "0 10px 10px 0", fontWeight: 500, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} style={{ opacity: a.acknowledged ? 0.4 : 1, transition: "opacity 0.3s" }}>
                  <td style={{ padding: "8px 10px 8px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: t.text2, whiteSpace: "nowrap" }}>{a.time}</td>
                  <td style={{ padding: "8px 10px 8px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: t.text }}>{a.src}</td>
                  <td style={{ padding: "8px 10px 8px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: t.text2 }}>{a.dst}</td>
                  <td style={{ padding: "8px 10px 8px 0", borderBottom: `0.5px solid ${t.border}`, color: t.text }}>{a.type}</td>
                  <td style={{ padding: "8px 10px 8px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: t.text3 }}>{a.sid}</td>
                  <td style={{ padding: "8px 10px 8px 0", borderBottom: `0.5px solid ${t.border}` }}><SevBadge sev={a.sev} t={t} /></td>
                  <td style={{ padding: "8px 10px 8px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: a.conf > 90 ? t.ok : a.conf > 80 ? t.warn : t.danger }}>{a.conf.toFixed(1)}%</td>
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
              No hay alertas que coincidan con los filtros.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
