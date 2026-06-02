import { useStyles } from "../hooks/useStyles";
import { MetricCard, SevBadge, Sparkline, SectionHeader } from "../components/ui/SharedUI";

export function PageDashboard({ alerts, t }) {
  const s = useStyles(t);

  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const critCount    = activeAlerts.filter((a) => a.sev === "crit").length;
  const avgConf      = alerts.length
    ? (alerts.reduce((acc, a) => acc + a.conf, 0) / alerts.length).toFixed(1)
    : 0;

  const topRules = [
    { sid: "1001", name: "Port scan TCP SYN", hits: 847 },
    { sid: "2034", name: "SQL injection HTTP", hits: 312 },
    { sid: "3017", name: "SSH brute force",    hits: 218 },
    { sid: "5211", name: "C2 beacon pattern",  hits: 61  },
  ];

  const typeBreakdown = [
    { label: "Port Scan",   val: 38, color: t.danger  },
    { label: "SQLi",        val: 22, color: t.warn     },
    { label: "Brute Force", val: 18, color: t.purple   },
    { label: "C2 Beacon",  val: 12, color: t.accent   },
    { label: "XSS",         val:  7, color: t.ok       },
    { label: "Otros",       val:  3, color: t.text3    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Metrics row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
        <MetricCard label="Paquetes analizados" value="847k"             sub="+12k / min"       color={t.accent} t={t} />
        <MetricCard label="Alertas activas"      value={activeAlerts.length} sub={`${critCount} críticas`} color={t.danger} t={t} />
        <MetricCard label="Confianza ML"         value={`${avgConf}%`}   sub="RF · 47 árboles"  color={t.ok}     t={t} />
        <MetricCard label="Falsos positivos"     value="7"               sub="Tasa: 0.82%"       color={t.warn}   t={t} />
      </div>

      {/* Recent alerts + sparkline row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={s.card}>
          <SectionHeader title="Alertas recientes" badge="LIVE ●" badgeVariant="live" t={t} />
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Hora", "Tipo", "Sev.", "Conf."].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.6px", color: t.text3, paddingBottom: 8, fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.slice(0, 6).map((a) => (
                <tr key={a.id}>
                  <td style={{ padding: "7px 8px 7px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: t.text2 }}>{a.time}</td>
                  <td style={{ padding: "7px 8px 7px 0", borderBottom: `0.5px solid ${t.border}`, color: t.text }}>{a.type}</td>
                  <td style={{ padding: "7px 8px 7px 0", borderBottom: `0.5px solid ${t.border}` }}><SevBadge sev={a.sev} t={t} /></td>
                  <td style={{ padding: "7px 0", fontFamily: "monospace", fontSize: 11, borderBottom: `0.5px solid ${t.border}`, color: a.conf > 90 ? t.ok : a.conf > 80 ? t.warn : t.danger }}>
                    {a.conf.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={s.card}>
            <SectionHeader title="Tráfico — última hora" t={t} />
            <Sparkline t={t} />
          </div>
          <div style={s.card}>
            <SectionHeader title="Firmas más activas" t={t} />
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {topRules.map((r) => (
                <div key={r.sid} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: t.text3, minWidth: 50 }}>SID:{r.sid}</span>
                  <span style={{ flex: 1, color: t.text }}>{r.name}</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: r.hits > 500 ? t.danger : r.hits > 200 ? t.warn : t.ok }}>{r.hits}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Type breakdown */}
      <div style={s.card}>
        <SectionHeader title="Distribución por tipo de ataque" t={t} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 10 }}>
          {typeBreakdown.map((d) => (
            <div key={d.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: d.color }}>{d.val}%</div>
              <div style={{ fontSize: 11, color: t.text2, marginTop: 2 }}>{d.label}</div>
              <div style={{ height: 4, background: t.bg4, borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${d.val * 2}%`, background: d.color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
