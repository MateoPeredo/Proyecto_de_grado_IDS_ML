import { useState } from "react";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, Toggle, SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { INITIAL_RULES } from "../utils/mockData";

export function PageReglas({ t }) {
  const s = useStyles(t);
  const [rules, setRules]       = useState(INITIAL_RULES);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: "", proto: "tcp", port: "", content: "", pri: "1" });

  const toggleRule = (id) =>
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));

  const deleteRule = (id) =>
    setRules((prev) => prev.filter((r) => r.id !== id));

  const addRule = () => {
    if (!form.name.trim()) return;
    setRules((prev) => [
      ...prev,
      {
        id:      Date.now(),
        sid:     String(8000 + prev.length),
        hits:    0,
        name:    form.name,
        proto:   form.proto,
        port:    form.port || "any",
        pri:     parseInt(form.pri),
        enabled: true,
      },
    ]);
    setForm({ name: "", proto: "tcp", port: "", content: "", pri: "1" });
    setShowForm(false);
  };

  const priColor = (pri) => (pri === 1 ? t.danger : pri === 2 ? t.warn : t.ok);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        <MetricCard label="Total reglas"  value={rules.length}                         color={t.accent} t={t} />
        <MetricCard label="Activas"       value={rules.filter((r) => r.enabled).length} color={t.ok}     t={t} />
        <MetricCard label="Desactivadas"  value={rules.filter((r) => !r.enabled).length}color={t.text2}  t={t} />
        <MetricCard label="Prioridad 1"   value={rules.filter((r) => r.pri === 1).length}color={t.danger} t={t} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showForm ? "1fr 1fr" : "1fr", gap: 14 }}>
        {/* Rule list */}
        <div style={s.card}>
          <SectionHeader title="Firmas cargadas" badge={`${rules.length} reglas`} t={t}>
            <button onClick={() => setShowForm((f) => !f)} style={s.btn("primary")}>
              <NavIcon name={showForm ? "x" : "plus"} size={14} />
              {showForm ? "Cancelar" : "Nueva regla"}
            </button>
          </SectionHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rules.map((r) => (
              <div key={r.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                background: t.bg3,
                borderRadius: 8,
                border: `0.5px solid ${t.border}`,
              }}>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: t.text3, minWidth: 64 }}>
                  SID:{r.sid}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 10, color: t.text3, marginTop: 1, fontFamily: "monospace" }}>
                    P<span style={{ color: priColor(r.pri), fontWeight: 700 }}>{r.pri}</span> · {r.proto} · :{r.port}
                  </div>
                </div>
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: r.hits > 200 ? t.danger : r.hits > 50 ? t.warn : t.ok, minWidth: 36, textAlign: "right" }}>
                  {r.hits}
                </span>
                <Toggle on={r.enabled} onChange={() => toggleRule(r.id)} t={t} />
                <button onClick={() => deleteRule(r.id)} style={{ ...s.btn("ghost"), padding: "4px 6px", border: "none", color: t.text3 }}>
                  <NavIcon name="x" size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* New rule form */}
        {showForm && (
          <div style={s.card}>
            <SectionHeader title="Nueva regla personalizada" t={t} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Nombre de la regla",    key: "name",    type: "text",  placeholder: "Mi regla custom"  },
                { label: "Contenido / payload",   key: "content", type: "text",  placeholder: "SELECT|20|FROM"   },
                { label: "Puerto destino",         key: "port",    type: "text",  placeholder: "80, 443, any"     },
              ].map((f) => (
                <div key={f.key}>
                  <label style={s.label}>{f.label}</label>
                  <input
                    style={s.input}
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={s.label}>Protocolo</label>
                  <select style={s.select} value={form.proto} onChange={(e) => setForm((p) => ({ ...p, proto: e.target.value }))}>
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="icmp">ICMP</option>
                    <option value="any">Any</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Prioridad</label>
                  <select style={s.select} value={form.pri} onChange={(e) => setForm((p) => ({ ...p, pri: e.target.value }))}>
                    <option value="1">1 — Crítica</option>
                    <option value="2">2 — Alta</option>
                    <option value="3">3 — Media</option>
                  </select>
                </div>
              </div>

              <button onClick={addRule} style={{ ...s.btn("primary"), justifyContent: "center", marginTop: 4 }}>
                <NavIcon name="check" size={14} /> Guardar regla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
