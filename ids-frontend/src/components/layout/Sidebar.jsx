import { NAV_ITEMS } from "../../utils/theme";
import { NavIcon } from "../ui/NavIcon";

export function Sidebar({ t, page, onNavigate, activeCount, collapsed, user }) {
  return (
    <div style={{
      width: collapsed ? 52 : 224,
      background: t.bg2,
      borderRight: `0.5px solid ${t.border}`,
      display: "flex",
      flexDirection: "column",
      transition: "width 0.2s",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{
        padding: "14px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderBottom: `0.5px solid ${t.border}`,
        minHeight: 52,
      }}>
        <div style={{
          width: 28, height: 28,
          background: t.accent,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <NavIcon name="shield" size={15} />
        </div>
        {!collapsed && (
          <span style={{ fontSize: 14, fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>
            SigmaIDS
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_ITEMS.map((n) => {
          const isActive  = page === n.id;
          const hasBadge  = n.id === "alertas" && activeCount > 0;
          return (
            <div
              key={n.id}
              onClick={() => onNavigate(n.id)}
              title={collapsed ? n.label : ""}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: collapsed ? "10px 14px" : "9px 12px",
                borderRadius: 8,
                margin: "1px 6px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                justifyContent: collapsed ? "center" : "flex-start",
                background:  isActive ? t.accentBg  : "transparent",
                color:       isActive ? t.accentTxt : t.text2,
                fontWeight:  isActive ? 500          : 400,
                fontSize: 13,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <NavIcon name={n.icon} size={16} />
              {!collapsed && <span style={{ flex: 1 }}>{n.label}</span>}
              {!collapsed && hasBadge && (
                <span style={{
                  background: t.dangerBg,
                  color: t.danger,
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 10,
                  fontFamily: "monospace",
                }}>
                  {activeCount}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* User + logout */}
      {!collapsed && (
        <div style={{ padding: "10px 8px", borderTop: `0.5px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8 }}>
            <div style={{
              width: 28, height: 28,
              borderRadius: "50%",
              background: t.accentBg,
              color: t.accentTxt,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {user?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user}
              </div>
              <div style={{ fontSize: 10, color: t.text3 }}>Administrador</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
