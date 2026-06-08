import { useStyles } from "../../hooks/useStyles";

// ── MetricCard ───────────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, color, t }) {
  const s = useStyles(t);
  return (
    <div style={s.metric}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: t.text3, marginBottom: 6, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace", lineHeight: 1, color: color || t.text }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: t.text3, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

// ── MlBar ────────────────────────────────────────────────────────────────────
export function MlBar({ label, value, color, t }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.text }}>
        <span>{label}</span>
        <span style={{ fontFamily: "monospace", color: t.text2 }}>{value}%</span>
      </div>
      <div style={{ height: 6, background: t.bg4, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: 3, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────────
export function Toggle({ on, onChange, t }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{
        width: 36, height: 20,
        background: on ? t.ok : t.bg4,
        borderRadius: 10,
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.2s",
      }}
    >
      <div style={{
        position: "absolute",
        width: 16, height: 16,
        background: "#fff",
        borderRadius: "50%",
        top: 2,
        left: on ? 18 : 2,
        transition: "left 0.2s",
      }} />
    </div>
  );
}

// ── SevBadge ─────────────────────────────────────────────────────────────────
export function SevBadge({ sev, t }) {
  const s = useStyles(t);
  // Acepta tanto los valores del backend (critical/high/medium/low)
  // como los abreviados que se usaban antes (crit/med).
  const norm = { critical: "crit", high: "high", medium: "med", low: "low" }[sev] ?? sev;
  const labels = { crit: "Crítico", high: "Alto", med: "Medio", low: "Bajo" };
  return <span style={s.sev(norm)}>{labels[norm] ?? sev}</span>;
}

// ── Sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({ t }) {
  const vals = [22, 18, 35, 41, 28, 19, 24, 55, 62, 48, 71, 89, 95, 82, 74, 66, 58, 43, 37, 29, 35, 47, 61, 73];
  const mx = Math.max(...vals);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 52 }}>
        {vals.map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${Math.round((v / mx) * 100)}%`,
              background: v > 70 ? t.danger : i === vals.length - 1 ? t.accent : t.bg4,
              borderRadius: "2px 2px 0 0",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.text3, fontFamily: "monospace", marginTop: 4 }}>
        <span>60min</span><span>30min</span><span>ahora</span>
      </div>
    </div>
  );
}

// ── ProgressBar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, color, t, height = 6 }) {
  return (
    <div style={{ height, background: t.bg4, borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: height / 2, transition: "width 0.4s ease" }} />
    </div>
  );
}

// ── SectionHeader ────────────────────────────────────────────────────────────
export function SectionHeader({ title, badge, badgeVariant = "default", children, t }) {
  const s = useStyles(t);
  return (
    <div style={s.panelHdr}>
      <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {badge && <span style={s.badge(badgeVariant)}>{badge}</span>}
        {children}
      </div>
    </div>
  );
}
