import { useState, useEffect } from "react";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, Toggle, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { signaturesService } from "../services/api";

// Tipos de firma conductual que el motor sabe interpretar
const TIPOS_FIRMA = [
  { value: "port_scan",     label: "Escaneo de puertos" },
  { value: "null_scan",     label: "Escaneo NULL" },
  { value: "fin_scan",      label: "Escaneo FIN" },
  { value: "xmas_scan",     label: "Escaneo XMAS" },
  { value: "udp_scan",      label: "Escaneo UDP" },
  { value: "ping_sweep",    label: "Barrido de red (ping)" },
  { value: "syn_flood",     label: "SYN Flood (DoS)" },
  { value: "icmp_flood",    label: "ICMP Flood" },
  { value: "udp_flood",     label: "UDP Flood" },
  { value: "ping_of_death", label: "Ping de la Muerte" },
  { value: "brute_force",   label: "Fuerza bruta" },
  { value: "land_attack",   label: "Ataque LAND" },
  { value: "conn_flood",    label: "Exceso de conexiones" },
];
const SEVERIDADES = [
  { value: "low", label: "Baja" }, { value: "medium", label: "Media" },
  { value: "high", label: "Alta" }, { value: "critical", label: "Crítica" },
];
const PROTOCOLOS = ["tcp", "udp", "icmp", "any"];

const formVacio = {
  nombre: "", tipo_firma: "port_scan", severidad: "medium",
  umbral: 20, ventana_segundos: 10, track_by: "src",
  puerto: "", protocolo: "tcp", enabled: true, descripcion: "",
};

export function PageReglas({ t }) {
  const s = useStyles(t);
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState(formVacio);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await signaturesService.getAll();
      setItems(res.data || []);
      setError("");
    } catch {
      setError("No se pudieron cargar las firmas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const toggle = async (f) => {
    try {
      await signaturesService.toggle(f.id, !f.enabled);
      setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, enabled: !x.enabled } : x)));
    } catch { /* noop */ }
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    // normaliza: puerto vacío -> null, números como números
    const payload = {
      ...form,
      umbral: Number(form.umbral),
      ventana_segundos: Number(form.ventana_segundos),
      puerto: form.puerto === "" || form.puerto === null ? null : Number(form.puerto),
    };
    try {
      if (editId) {
        const res = await signaturesService.update(editId, payload);
        setItems((prev) => prev.map((x) => (x.id === editId ? res.data : x)));
      } else {
        const res = await signaturesService.create(payload);
        setItems((prev) => [...prev, res.data]);
      }
      cancelar();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo guardar la firma.");
    }
  };

  const empezarEdicion = (f) => {
    setEditId(f.id);
    setForm({
      nombre: f.nombre, tipo_firma: f.tipo_firma, severidad: f.severidad,
      umbral: f.umbral, ventana_segundos: f.ventana_segundos, track_by: f.track_by,
      puerto: f.puerto ?? "", protocolo: f.protocolo, enabled: f.enabled,
      descripcion: f.descripcion ?? "",
    });
    setShowForm(true);
    setError("");
  };

  const cancelar = () => {
    setEditId(null); setForm(formVacio); setShowForm(false); setError("");
  };

  const borrar = async (id) => {
    if (!window.confirm("¿Eliminar esta firma?")) return;
    try {
      await signaturesService.delete(id);
      setItems((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo eliminar la firma.");
    }
  };

  const sevLabel = (v) => SEVERIDADES.find((x) => x.value === v)?.label ?? v;
  const tipoLabel = (v) => TIPOS_FIRMA.find((x) => x.value === v)?.label ?? v;
  const activas = items.filter((f) => f.enabled).length;
  const criticas = items.filter((f) => f.severidad === "critical").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        <MetricCard label="Total firmas" value={items.length} color={t.accent} t={t} />
        <MetricCard label="Activas"      value={activas}      color={t.ok}     t={t} />
        <MetricCard label="Desactivadas" value={items.length - activas} color={t.text2} t={t} />
        <MetricCard label="Críticas"     value={criticas}     color={t.danger} t={t} />
      </div>

      {error && <div style={{ fontSize: 12, color: t.danger, background: t.dangerBg, border: `0.5px solid ${t.danger}`, padding: "9px 12px", borderRadius: 8 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: showForm ? "1fr 1fr" : "1fr", gap: 14 }}>
        {/* Lista */}
        <div style={s.card}>
          <SectionHeader title="Firmas cargadas" badge={`${items.length}`} t={t}>
            <button onClick={() => (showForm ? cancelar() : setShowForm(true))} style={s.btn("primary")}>
              <NavIcon name={showForm ? "x" : "plus"} size={14} />
              {showForm ? "Cancelar" : "Nueva firma"}
            </button>
          </SectionHeader>

          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: t.text3, fontSize: 13 }}>Cargando...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: t.text3, fontSize: 13 }}>
              Sin firmas aún. Crea la primera con "Nueva firma".
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((f) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: t.bg3, borderRadius: 8, border: `0.5px solid ${t.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>
                      {f.nombre}
                      <span style={{ fontSize: 9, marginLeft: 6, padding: "1px 6px", borderRadius: 8, background: f.severidad === "critical" || f.severidad === "high" ? t.dangerBg : t.bg2, color: f.severidad === "critical" || f.severidad === "high" ? t.danger : t.text3 }}>
                        {sevLabel(f.severidad)}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: t.text3, marginTop: 2, fontFamily: "monospace" }}>
                      {tipoLabel(f.tipo_firma)} · umbral {f.umbral}/{f.ventana_segundos}s · {f.track_by}
                      {f.puerto ? ` · puerto ${f.puerto}` : ""} · {f.protocolo}
                    </div>
                  </div>
                  <Toggle on={f.enabled} onChange={() => toggle(f)} t={t} />
                  <button onClick={() => empezarEdicion(f)} style={{ ...s.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>Editar</button>
                  <button onClick={() => borrar(f.id)} style={{ ...s.btn("ghost"), padding: "4px 6px", border: "none", color: t.text3 }}>
                    <NavIcon name="x" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulario */}
        {showForm && (
          <div style={s.card}>
            <SectionHeader title={editId ? "Editar firma" : "Nueva firma"} t={t} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={s.label}>Nombre descriptivo</label>
                <input style={s.input} value={form.nombre} placeholder="Ej: Escaneo de puertos agresivo"
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={s.label}>Tipo de firma</label>
                  <select style={s.select} value={form.tipo_firma}
                    onChange={(e) => setForm((p) => ({ ...p, tipo_firma: e.target.value }))}>
                    {TIPOS_FIRMA.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Severidad</label>
                  <select style={s.select} value={form.severidad}
                    onChange={(e) => setForm((p) => ({ ...p, severidad: e.target.value }))}>
                    {SEVERIDADES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={s.label}>Umbral (eventos)</label>
                  <input style={s.input} type="number" min={1} value={form.umbral}
                    onChange={(e) => setForm((p) => ({ ...p, umbral: e.target.value }))} />
                </div>
                <div>
                  <label style={s.label}>Ventana (segundos)</label>
                  <input style={s.input} type="number" min={1} value={form.ventana_segundos}
                    onChange={(e) => setForm((p) => ({ ...p, ventana_segundos: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={s.label}>Rastrear por</label>
                  <select style={s.select} value={form.track_by}
                    onChange={(e) => setForm((p) => ({ ...p, track_by: e.target.value }))}>
                    <option value="src">IP origen</option>
                    <option value="dst">IP destino</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Protocolo</label>
                  <select style={s.select} value={form.protocolo}
                    onChange={(e) => setForm((p) => ({ ...p, protocolo: e.target.value }))}>
                    {PROTOCOLOS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Puerto (opcional)</label>
                  <input style={s.input} type="number" value={form.puerto} placeholder="ej: 22"
                    onChange={(e) => setForm((p) => ({ ...p, puerto: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={s.label}>Descripción (opcional)</label>
                <input style={s.input} value={form.descripcion}
                  onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} />
              </div>
              <button onClick={guardar} style={{ ...s.btn("primary"), justifyContent: "center", padding: 10 }}>
                <NavIcon name="check" size={14} /> {editId ? "Guardar cambios" : "Crear firma"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
