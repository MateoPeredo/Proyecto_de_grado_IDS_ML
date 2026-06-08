import { useState, useEffect } from "react";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, Toggle, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { rulesService } from "../services/api";

// Página de reglas/firmas conectada al backend real (MySQL). Sin datos simulados.
export function PageReglas({ t }) {
  const s = useStyles(t);
  const [rules, setRules]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", pattern: "", protocol: "tcp", severity: "medium", description: "",
  });

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await rulesService.getAll();
      setRules(res.data || []);
      setError("");
    } catch {
      setError("No se pudieron cargar las reglas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const toggleRule = async (r) => {
    try {
      await rulesService.toggle(r.id, !r.enabled);
      setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)));
    } catch { /* noop */ }
  };

  const deleteRule = async (id) => {
    try {
      await rulesService.delete(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch { /* noop */ }
  };

  const addRule = async () => {
    if (!form.name.trim() || !form.pattern.trim()) return;
    try {
      const res = await rulesService.create(form);
      setRules((prev) => [...prev, res.data]);
      setForm({ name: "", pattern: "", protocol: "tcp", severity: "medium", description: "" });
      setShowForm(false);
    } catch {
      setError("No se pudo crear la regla.");
    }
  };

  const sevColor = (sev) =>
    sev === "critical" ? t.danger : sev === "high" ? t.danger : sev === "medium" ? t.warn : t.ok;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        <MetricCard label="Total reglas"  value={rules.length}                          color={t.accent} t={t} />
        <MetricCard label="Activas"       value={rules.filter((r) => r.enabled).length}  color={t.ok}     t={t} />
        <MetricCard label="Desactivadas"  value={rules.filter((r) => !r.enabled).length} color={t.text2}  t={t} />
        <MetricCard label="Críticas"      value={rules.filter((r) => r.severity === "critical").length} color={t.danger} t={t} />
      </div>

      {error && <div style={{ fontSize: 12, color: t.danger }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: showForm ? "1fr 1fr" : "1fr", gap: 14 }}>
        {/* Lista de reglas */}
        <div style={s.card}>
          <SectionHeader title="Firmas cargadas" badge={`${rules.length} reglas`} t={t}>
            <button onClick={() => setShowForm((f) => !f)} style={s.btn("primary")}>
              <NavIcon name={showForm ? "x" : "plus"} size={14} />
              {showForm ? "Cancelar" : "Nueva regla"}
            </button>
          </SectionHeader>

          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: t.text3, fontSize: 13 }}>Cargando...</div>
          ) : rules.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: t.text3, fontSize: 13 }}>
              Sin reglas aún. Crea la primera con "Nueva regla".
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rules.map((r) => (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", background: t.bg3, borderRadius: 8,
                  border: `0.5px solid ${t.border}`,
                }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: t.text3, minWidth: 48 }}>
                    #{r.id}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 10, color: t.text3, marginTop: 1, fontFamily: "monospace" }}>
                      <span style={{ color: sevColor(r.severity), fontWeight: 700 }}>{r.severity}</span> · {r.protocol}
                    </div>
                  </div>
                  <Toggle on={r.enabled} onChange={() => toggleRule(r)} t={t} />
                  <button onClick={() => deleteRule(r.id)} style={{ ...s.btn("ghost"), padding: "4px 6px", border: "none", color: t.text3 }}>
                    <NavIcon name="x" size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulario nueva regla */}
        {showForm && (
          <div style={s.card}>
            <SectionHeader title="Nueva regla de firma" t={t} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Nombre de la regla",  key: "name",        placeholder: "Detección escaneo de puertos" },
                { label: "Patrón / firma",      key: "pattern",     placeholder: "contenido o patrón a detectar" },
                { label: "Descripción",         key: "description", placeholder: "opcional" },
              ].map((f) => (
                <div key={f.key}>
                  <label style={s.label}>{f.label}</label>
                  <input
                    style={s.input}
                    value={form[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={s.label}>Protocolo</label>
                  <select style={s.select} value={form.protocol} onChange={(e) => setForm((p) => ({ ...p, protocol: e.target.value }))}>
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="icmp">ICMP</option>
                    <option value="any">Any</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Severidad</label>
                  <select style={s.select} value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}>
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
              </div>
              <button onClick={addRule} style={{ ...s.btn("primary"), justifyContent: "center", padding: 10 }}>
                <NavIcon name="check" size={14} /> Guardar regla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
