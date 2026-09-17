import { useEffect, useState } from "react";
import { useStyles } from "../hooks/useStyles";
import { SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { accionesService } from "../services/api";

// Color por fase del ciclo NIST SP 800-61 (usa los tokens del tema).
function colorFase(fase, t) {
  const f = fase.toLowerCase();
  if (f.startsWith("detección")) return t.accent;
  if (f.startsWith("contención")) return t.danger;
  if (f.startsWith("erradicación")) return t.warn;
  if (f.startsWith("recuperación")) return t.ok;
  return t.text3; // post-incidente
}

// Color del punto por familia de ataque.
function colorFamilia(familia, t) {
  const f = (familia || "").toLowerCase();
  if (f.startsWith("reconocimiento")) return t.accent;
  if (f.startsWith("denegación")) return t.danger;
  if (f.startsWith("acceso")) return t.warn;
  return t.text3;
}

/**
 * Guía de respuesta: catálogo completo de acciones a tomar por tipo de ataque,
 * basado en NIST SP 800-61. Lista a la izquierda, detalle a la derecha.
 */
export function PageAcciones({ t }) {
  const s = useStyles(t);
  const [playbooks, setPlaybooks] = useState([]);
  const [sel, setSel] = useState(null);
  const [estado, setEstado] = useState("cargando"); // cargando | ok | error
  const [q, setQ] = useState("");

  useEffect(() => {
    let vivo = true;
    accionesService
      .getAll()
      .then((r) => {
        if (!vivo) return;
        setPlaybooks(r.data);
        setSel(r.data[0] ?? null);
        setEstado("ok");
      })
      .catch(() => { if (vivo) setEstado("error"); });
    return () => { vivo = false; };
  }, []);

  const lista = playbooks.filter((p) => {
    if (!q) return true;
    const hay = `${p.titulo} ${p.familia} ${p.resumen}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Intro */}
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <NavIcon name="shield" size={16} />
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Guía de respuesta a incidentes</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: t.text2, lineHeight: 1.5 }}>
          Acciones recomendadas para cada tipo de ataque que detecta el IDS, organizadas según las
          fases del estándar internacional <strong>NIST SP 800-61 Rev. 2</strong> (Detección y análisis ·
          Contención · Erradicación · Recuperación · Post-incidente).
        </p>
      </div>

      {estado === "cargando" && (
        <div style={{ ...s.card, textAlign: "center", color: t.text3, fontSize: 13, padding: "28px 0" }}>
          Cargando guía de respuesta…
        </div>
      )}
      {estado === "error" && (
        <div style={{ ...s.card, textAlign: "center", color: t.text3, fontSize: 13, padding: "28px 0" }}>
          No se pudo cargar la guía. Verificá la conexión con el backend.
        </div>
      )}

      {estado === "ok" && (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Lista de ataques */}
          <div style={{ ...s.card, flex: "1 1 260px", maxWidth: 320, minWidth: 240 }}>
            <input
              style={{ ...s.input, marginBottom: 10 }}
              placeholder="Buscar ataque…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: "60vh", overflowY: "auto" }}>
              {lista.map((p) => {
                const activo = sel && sel.tipo_firma === p.tipo_firma;
                return (
                  <div
                    key={p.tipo_firma}
                    onClick={() => setSel(p)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "9px 10px", borderRadius: 8, cursor: "pointer",
                      background: activo ? t.accentBg : "transparent",
                      color: activo ? t.accentTxt : t.text,
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorFamilia(p.familia, t), flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: activo ? 600 : 400 }}>{p.titulo}</span>
                  </div>
                );
              })}
              {lista.length === 0 && (
                <div style={{ textAlign: "center", padding: "18px 0", color: t.text3, fontSize: 12 }}>
                  Sin resultados
                </div>
              )}
            </div>
          </div>

          {/* Detalle del playbook */}
          <div style={{ ...s.card, flex: "3 1 420px", minWidth: 300 }}>
            {sel && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{sel.titulo}</span>
                    {sel.familia && <span style={s.badge("info")}>{sel.familia}</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: t.text2, lineHeight: 1.5 }}>{sel.resumen}</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {sel.fases.map((f, i) => {
                    const c = colorFase(f.fase, t);
                    return (
                      <div key={i} style={{ borderLeft: `3px solid ${c}`, paddingLeft: 12 }}>
                        <div style={{
                          fontSize: 11, fontWeight: 700, color: c,
                          textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6,
                        }}>
                          {i + 1}. {f.fase}
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                          {f.acciones.map((a, j) => (
                            <li key={j} style={{ fontSize: 13, color: t.text, lineHeight: 1.45 }}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                <div style={{
                  marginTop: 4, paddingTop: 10, borderTop: `0.5px solid ${t.border}`,
                  fontSize: 11, color: t.text3, fontStyle: "italic",
                }}>
                  Basado en {sel.referencia}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
