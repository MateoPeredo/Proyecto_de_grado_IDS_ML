import { useState, useEffect } from "react";
import { useStyles } from "../hooks/useStyles";
import { SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { logsService } from "../services/api";

const TABS = [
  { id: "plataforma", label: "Plataforma" },
  { id: "deteccion",  label: "Detección" },
  { id: "trafico",    label: "Tráfico" },
];

export function PageLogs({ t }) {
  const s = useStyles(t);
  const [tab, setTab]       = useState("plataforma");
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);

  // filtros de búsqueda para tráfico
  const [filtroIp, setFiltroIp]       = useState("");
  const [filtroProto, setFiltroProto] = useState("");
  // buscador de texto para plataforma y detección (filtra sobre lo ya cargado)
  const [busqueda, setBusqueda] = useState("");

  const cargar = async () => {
    setLoading(true);
    try {
      let res;
      if (tab === "plataforma") res = await logsService.plataforma({ limit: 200 });
      else if (tab === "deteccion") res = await logsService.deteccion({ limit: 200 });
      else {
        const params = { limit: 200 };
        if (filtroIp.trim())   params.ip = filtroIp.trim();
        if (filtroProto.trim()) params.protocolo = filtroProto.trim();
        res = await logsService.trafico(params);
      }
      setRows(res.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setBusqueda(""); cargar(); /* eslint-disable-next-line */ }, [tab]);

  // Filtrado por texto (cliente) para plataforma y detección: busca en todos los campos
  const filasFiltradas = (() => {
    if (tab === "trafico" || !busqueda.trim()) return rows;
    const q = busqueda.trim().toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q))
    );
  })();

  const fmt = (ts) => {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
  };

  // Define las columnas según la pestaña activa
  const columnas = {
    plataforma: [
      { k: "timestamp", h: "Hora", fmt },
      { k: "nivel",     h: "Nivel" },
      { k: "evento",    h: "Evento" },
      { k: "usuario",   h: "Usuario" },
      { k: "mensaje",   h: "Mensaje" },
    ],
    deteccion: [
      { k: "timestamp", h: "Hora", fmt },
      { k: "motor",     h: "Motor" },
      { k: "resultado", h: "Resultado" },
      { k: "confianza", h: "Confianza" },
      { k: "detalle",   h: "Detalle" },
    ],
    trafico: [
      { k: "timestamp",     h: "Hora", fmt },
      { k: "ip_origen",     h: "IP Origen" },
      { k: "ip_destino",    h: "IP Destino" },
      { k: "puerto_destino",h: "Puerto" },
      { k: "protocolo",     h: "Protocolo" },
      { k: "clasificacion", h: "Clasificación" },
    ],
  }[tab];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Pestañas */}
      <div style={{ display: "flex", gap: 6 }}>
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            style={{ ...s.btn(tab === tb.id ? "primary" : "ghost"), fontSize: 13, padding: "7px 16px" }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* Búsqueda (solo en tráfico) */}
      {tab === "trafico" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            style={{ ...s.input, maxWidth: 200 }}
            placeholder="Buscar por IP..."
            value={filtroIp}
            onChange={(e) => setFiltroIp(e.target.value)}
          />
          <input
            style={{ ...s.input, maxWidth: 140 }}
            placeholder="Protocolo (tcp...)"
            value={filtroProto}
            onChange={(e) => setFiltroProto(e.target.value)}
          />
          <button onClick={cargar} style={s.btn("primary")}>
            <NavIcon name="activity" size={14} /> Buscar
          </button>
        </div>
      )}

      {/* Buscador de texto (plataforma y detección) */}
      {tab !== "trafico" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            style={{ ...s.input, maxWidth: 320 }}
            placeholder="Buscar en los logs (usuario, evento, mensaje...)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} style={{ ...s.btn("ghost"), fontSize: 12 }}>
              Limpiar
            </button>
          )}
        </div>
      )}

      <div style={s.card}>
        <SectionHeader
          title={`Logs — ${TABS.find((x) => x.id === tab).label}`}
          badge={`${filasFiltradas.length}`}
          t={t}
        >
          <button onClick={cargar} style={{ ...s.btn("ghost"), fontSize: 12 }}>
            <NavIcon name="refresh" size={13} /> Recargar
          </button>
        </SectionHeader>

        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: t.text3, fontSize: 13 }}>Cargando...</div>
        ) : filasFiltradas.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: t.text3, fontSize: 13 }}>
            {busqueda.trim()
              ? "Sin resultados para la búsqueda."
              : "Sin registros aún. Los logs aparecerán cuando el sistema y el motor del IDS generen actividad."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 640 }}>
              <thead>
                <tr>
                  {columnas.map((c) => (
                    <th key={c.k} style={{ textAlign: "left", fontSize: 10, textTransform: "uppercase", color: t.text3, padding: "0 10px 10px 0", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {c.h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map((r) => (
                  <tr key={r.id}>
                    {columnas.map((c) => (
                      <td key={c.k} style={{ padding: "8px 10px 8px 0", borderBottom: `0.5px solid ${t.border}`, color: t.text2, fontFamily: c.k.includes("ip") || c.k === "timestamp" ? "monospace" : "inherit", fontSize: 11, whiteSpace: "nowrap" }}>
                        {c.fmt ? c.fmt(r[c.k]) : (r[c.k] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
