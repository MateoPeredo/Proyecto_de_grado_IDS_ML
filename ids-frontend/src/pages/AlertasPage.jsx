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
  const [segmento, setSegmento] = useState("todos");

  const filtered = alerts.filter((a) => {
    if (filter === "active" && a.acknowledged) return false;
    if (filter !== "all" && filter !== "active" && a.severity !== filter) return false;
    if (segmento !== "todos" && (a.segmento || "datos") !== segmento) return false;
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
        <select value={segmento} onChange={(e) => setSegmento(e.target.value)}
          style={{ fontSize: 12, padding: "7px 10px", borderRadius: 6,
                   background: t.card, color: t.text, border: `1px solid ${t.border}` }}>
          <option value="todos">Todos los segmentos</option>
          <option value="datos">Red de Datos</option>
          <option value="contable">Contabilidad</option>
          <option value="wifi">WiFi</option>
          <option value="dmz">Producción (DMZ)</option>
          <option value="prodv2">Producción V2</option>
          <option value="riesgos">Riesgos</option>
        </select>
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
                {["Hora", "IP Origen", "IP Destino", "Firma", "Protocolo", "Detectado por", "Validación ML", "Severidad", "Estado", ""].map((h) => (
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
                  <td style={{ padding: "8px 10px 8px 0", borderBottom: `0.5px solid ${t.border}` }}>
                    {(() => {
                      const estado = a.ml_estado || (a.ml_validado ? "confirmado" : "sin_ml");
                      // CONFIRMADO: el ML dice que es un ataque. Mostramos la clase y su confianza.
                      if (estado === "confirmado") {
                        const clase = a.ml_clase ? `: ${a.ml_clase}` : "";
                        const conf = a.ml_confianza != null ? ` (${a.ml_confianza}%)` : "";
                        return (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 11, fontWeight: 600, color: "#16a34a",
                            background: "#16a34a18", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap",
                          }} title="El modelo ML confirma que es un ataque (las dos etapas coinciden)">
                            ✓ Ataque{clase}{conf}
                          </span>
                        );
                      }
                      // NO CONCLUYENTE: el ML no respaldó, pero la firma la conservó.
                      // NO mostramos el % (era la confianza de BENIGN y confunde).
                      if (estado === "no_concluyente") {
                        return (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 11, fontWeight: 600, color: "#d97706",
                            background: "#d9770618", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap",
                          }} title="El ML no confirmó el ataque; la alerta se conserva porque la firma la detectó por patrón de volumen (ej. fuerza bruta)">
                            ⚠ Detectado por firma
                          </span>
                        );
                      }
                      // SIN ML: no hubo verificación (no había flujo o no hay modelo).
                      return <span style={{ fontSize: 11, color: t.text3 }}>— sin ML</span>;
                    })()}
                  </td>
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