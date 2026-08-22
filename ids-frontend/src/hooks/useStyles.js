export function useStyles(t) {
  return {
    card: {
      background: t.bg2,
      border: `0.5px solid ${t.border}`,
      borderRadius: 12,
      padding: "16px 18px",
    },
    metric: {
      background: t.bg3,
      border: `0.5px solid ${t.border}`,
      borderRadius: 10,
      padding: "14px 16px",
    },
    input: {
      width: "100%",
      padding: "9px 12px",
      border: `0.5px solid ${t.border2}`,
      borderRadius: 8,
      background: t.bg3,
      color: t.text,
      fontSize: 13,
      fontFamily: "inherit",
      outline: "none",
    },
    select: {
      width: "100%",
      padding: "9px 12px",
      border: `0.5px solid ${t.border2}`,
      borderRadius: 8,
      background: t.bg3,
      color: t.text,
      fontSize: 13,
      fontFamily: "inherit",
      outline: "none",
      // colorScheme hace que el menú desplegable nativo use los colores del tema
      // (texto claro sobre fondo oscuro en modo oscuro, y viceversa).
      colorScheme: t.bg === "#f4f5f7" ? "light" : "dark",
    },
    label: {
      fontSize: 11,
      fontWeight: 500,
      color: t.text2,
      textTransform: "uppercase",
      letterSpacing: "0.6px",
      marginBottom: 5,
      display: "block",
    },
    panelHdr: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
      paddingBottom: 12,
      borderBottom: `0.5px solid ${t.border}`,
    },
    btn: (variant = "default") => {
      const variants = {
        default: { background: t.bg3,      color: t.text,   border: `0.5px solid ${t.border2}` },
        primary: { background: t.accent,   color: "#fff",   border: "none"                      },
        danger:  { background: t.dangerBg, color: t.danger, border: `0.5px solid ${t.danger}`   },
        ghost:   { background: "transparent", color: t.text2, border: `0.5px solid ${t.border}` },
      };
      return {
        ...variants[variant],
        padding: "8px 16px",
        borderRadius: 8,
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "inherit",
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      };
    },
    sev: (s) => {
      const map = {
        crit: { background: t.dangerBg, color: t.danger },
        high: { background: t.warnBg,   color: t.warn   },
        med:  { background: "#fefce8",  color: "#a16207" },
        low:  { background: t.okBg,     color: t.ok      },
      };
      return {
        ...map[s],
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 4,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.4px",
      };
    },
    badge: (variant = "default") => {
      const v = {
        default: { background: t.bg3,      color: t.text3,    border: `0.5px solid ${t.border}`  },
        live:    { background: t.okBg,     color: t.ok,       border: `0.5px solid ${t.ok}`      },
        danger:  { background: t.dangerBg, color: t.danger,   border: `0.5px solid ${t.danger}`  },
        warn:    { background: t.warnBg,   color: t.warn,     border: `0.5px solid ${t.warn}`    },
        info:    { background: t.accentBg, color: t.accentTxt,border: `0.5px solid ${t.accent}`  },
      };
      return {
        ...v[variant],
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 4,
        fontFamily: "monospace",
        fontWeight: 500,
      };
    },
  };
}
