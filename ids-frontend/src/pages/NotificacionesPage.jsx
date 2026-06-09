import { useState, useEffect } from "react";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, Toggle, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { notificationsService } from "../services/api";

const TIPOS_ATAQUE = ["any", "DoS", "DDoS", "PortScan", "BruteForce", "WebAttack", "Bot"];
const SEVERIDADES  = [
  { value: "low",      label: "Baja" },
  { value: "medium",   label: "Media" },
  { value: "high",     label: "Alta" },
  { value: "critical", label: "Crítica" },
];

export function PageNotificaciones({ t }) {
  const s = useStyles(t);
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);   // null = creando, id = editando
  const [form, setForm] = useState({
    nombre: "", email: "", severidad_minima: "high", tipo_ataque: "any", enabled: true,
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await notificationsService.getAll();
      setItems(res.data || []);
      setError("");
    } catch {
      setError("No se pudieron cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const toggle = async (n) => {
    try {
      await notificationsService.toggle(n.id, !n.enabled);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, enabled: !x.enabled } : x)));
    } catch { /* noop */ }
  };

  const eliminar = async (id) => {
    try {
      await notificationsService.delete(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch { /* noop */ }
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.email.trim()) return;
    try {
      if (editId) {
        const res = await notificationsService.update(editId, form);
        setItems((prev) => prev.map((x) => (x.id === editId ? res.data : x)));
      } else {
        const res = await notificationsService.create(form);
        setItems((prev) => [...prev, res.data]);
      }
      cancelarForm();
    } catch {
      setError(editId ? "No se pudo actualizar la notificación." : "No se pudo crear la notificación.");
    }
  };

  const empezarEdicion = (n) => {
    setEditId(n.id);
    setForm({
      nombre: n.nombre, email: n.email,
      severidad_minima: n.severidad_minima, tipo_ataque: n.tipo_ataque,
      enabled: n.enabled,
    });
    setShowForm(true);
  };

  const cancelarForm = () => {
    setEditId(null);
    setForm({ nombre: "", email: "", severidad_minima: "high", tipo_ataque: "any", enabled: true });
    setShowForm(false);
  };

  const sevLabel = (v) => SEVERIDADES.find((s) => s.value === v)?.label ?? v;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        <MetricCard label="Reglas de aviso" value={items.length}                          color={t.accent} t={t} />
        <MetricCard label="Activas"         value={items.filter((n) => n.enabled).length}  color={t.ok}     t={t} />
        <MetricCard label="Inactivas"       value={items.filter((n) => !n.enabled).length} color={t.text2}  t={t} />
      </div>

      {/* Aviso de que el envío real es etapa posterior */}
      <div style={{ fontSize: 12, color: t.text3, background: t.bg3, border: `0.5px solid ${t.border}`, borderRadius: 8, padding: "9px 12px" }}>
        Estas reglas definen a quién avisar y bajo qué condiciones. El envío efectivo de correos se implementará en una etapa posterior.
      </div>

      {error && <div style={{ fontSize: 12, color: t.danger }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: showForm ? "1fr 1fr" : "1fr", gap: 14 }}>
        {/* Lista */}
        <div style={s.card}>
          <SectionHeader title="Reglas de notificación" badge={`${items.length}`} t={t}>
            <button onClick={() => (showForm ? cancelarForm() : setShowForm(true))} style={s.btn("primary")}>
              <NavIcon name={showForm ? "x" : "plus"} size={14} />
              {showForm ? "Cancelar" : "Nueva notificación"}
            </button>
          </SectionHeader>

          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: t.text3, fontSize: 13 }}>Cargando...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: t.text3, fontSize: 13 }}>
              Sin notificaciones aún. Crea la primera con "Nueva notificación".
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {items.map((n) => (
                <div key={n.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", background: t.bg3, borderRadius: 8,
                  border: `0.5px solid ${t.border}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{n.nombre}</div>
                    <div style={{ fontSize: 10, color: t.text3, marginTop: 2, fontFamily: "monospace" }}>
                      {n.email} · ≥ {sevLabel(n.severidad_minima)} · {n.tipo_ataque}
                    </div>
                  </div>
                  <Toggle on={n.enabled} onChange={() => toggle(n)} t={t} />
                  <button onClick={() => empezarEdicion(n)} style={{ ...s.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>
                    Editar
                  </button>
                  <button onClick={() => eliminar(n.id)} style={{ ...s.btn("ghost"), padding: "4px 6px", border: "none", color: t.text3 }}>
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
            <SectionHeader title={editId ? "Editar notificación" : "Nueva regla de notificación"} t={t} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={s.label}>Nombre descriptivo</label>
                <input style={s.input} value={form.nombre}
                  placeholder="Avisar DDoS críticos a admin"
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={s.label}>Email destino</label>
                <input style={s.input} type="email" value={form.email}
                  placeholder="admin@empresa.com"
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={s.label}>Severidad mínima</label>
                  <select style={s.select} value={form.severidad_minima}
                    onChange={(e) => setForm((p) => ({ ...p, severidad_minima: e.target.value }))}>
                    {SEVERIDADES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Tipo de ataque</label>
                  <select style={s.select} value={form.tipo_ataque}
                    onChange={(e) => setForm((p) => ({ ...p, tipo_ataque: e.target.value }))}>
                    {TIPOS_ATAQUE.map((tp) => <option key={tp} value={tp}>{tp === "any" ? "Cualquiera" : tp}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={guardar} style={{ ...s.btn("primary"), justifyContent: "center", padding: 10 }}>
                <NavIcon name="check" size={14} /> {editId ? "Guardar cambios" : "Guardar notificación"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
