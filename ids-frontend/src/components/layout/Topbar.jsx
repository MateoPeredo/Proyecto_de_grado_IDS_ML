import { NavIcon } from "../ui/NavIcon";
import { useStyles } from "../../hooks/useStyles";
import { useClock } from "../../hooks/useClock";
import { NAV_ITEMS } from "../../utils/theme";

export function Topbar({ t, page, mode, onToggleTheme, onToggleSidebar, onLogout }) {
  const s     = useStyles(t);
  const clock = useClock();
  const title = NAV_ITEMS.find((n) => n.id === page)?.label ?? "";

  return (
    <div style={{
      background: t.bg2,
      borderBottom: `0.5px solid ${t.border}`,
      padding: "0 20px",
      height: 52,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0,
    }}>
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onToggleSidebar}
          style={{ ...s.btn("ghost"), padding: 6, border: "none", background: "transparent" }}
        >
          <NavIcon name="menu" size={16} />
        </button>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.ok, boxShadow: `0 0 0 3px ${t.okBg}` }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: t.text }}>{title}</span>
        <span style={{ fontSize: 11, color: t.text3, fontFamily: "monospace" }}>{clock}</span>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onToggleTheme} style={{ ...s.btn("ghost"), fontSize: 12 }}>
          <NavIcon name={mode === "light" ? "moon" : "sun"} size={14} />
          {mode === "light" ? "Oscuro" : "Claro"}
        </button>
        <span style={s.badge("live")}>LIVE ●</span>
        <button onClick={onLogout} style={{ ...s.btn("ghost"), fontSize: 12 }}>
          <NavIcon name="logout" size={14} />
          Salir
        </button>
      </div>
    </div>
  );
}
