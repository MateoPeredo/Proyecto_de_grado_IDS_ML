import { useState, useEffect } from "react";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, SectionHeader } from "../components/ui/SharedUI";
import { STREAM_PACKETS } from "../utils/mockData";

export function PageMonitoreo({ t }) {
  const s = useStyles(t);
  const [stream, setStream] = useState([
    { id: 1, time: "14:23:11", src: "192.168.1.1",   dst: "10.0.0.1",  proto: "TCP:80",  status: "CLEAN",          alert: false },
    { id: 2, time: "14:23:10", src: "203.0.113.42",  dst: "10.0.0.15", proto: "TCP:22",  status: "ALERT SID:3017", alert: true  },
    { id: 3, time: "14:23:09", src: "10.0.0.88",     dst: "8.8.8.8",   proto: "UDP:53",  status: "CLEAN",          alert: false },
    { id: 4, time: "14:23:08", src: "198.51.100.7",  dst: "10.0.0.22", proto: "TCP:80",  status: "ALERT SID:2034", alert: true  },
    { id: 5, time: "14:23:07", src: "172.16.0.5",    dst: "10.0.0.3",  proto: "TCP:443", status: "CLEAN",          alert: false },
    { id: 6, time: "14:23:06", src: "192.168.1.200", dst: "10.0.0.1",  proto: "ICMP",    status: "CLEAN",          alert: false },
  ]);
  const [pps, setPps] = useState(1247);
  let pkIdx = 0;

  useEffect(() => {
    const iv = setInterval(() => {
      const p   = STREAM_PACKETS[pkIdx % STREAM_PACKETS.length];
      pkIdx += 1;
      const now = new Date().toLocaleTimeString("es-BO", { hour12: false });
      setStream((prev) => [{ ...p, id: Date.now(), time: now }, ...prev].slice(0, 14));
      setPps((prev) => Math.max(800, prev + Math.floor(Math.random() * 100 - 40)));
    }, 1800);
    return () => clearInterval(iv);
  }, []);

  const protocols = [
    { label: "TCP",   val: 64, color: t.accent  },
    { label: "UDP",   val: 28, color: t.ok       },
    { label: "ICMP",  val:  6, color: t.warn     },
    { label: "Otros", val:  2, color: t.text3    },
  ];

  const topIPs = [
    { ip: "203.0.113.42",  hits: 312, color: t.danger },
    { ip: "198.51.100.7",  hits: 218, color: t.warn   },
    { ip: "192.168.1.104", hits:  94, color: t.ok     },
    { ip: "10.10.0.44",    hits:  61, color: t.danger },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        <MetricCard label="Paquetes/seg"  value={pps.toLocaleString()} color={t.accent}  t={t} />
        <MetricCard label="Mbps entrada"  value="847"                  color={t.text}    t={t} />
        <MetricCard label="Latencia ML"   value="0.8ms"                color={t.ok}      t={t} />
        <MetricCard label="Interfaz"      value="eth0"                  color={t.text}    t={t} />
        <MetricCard label="Sesiones TCP"  value="3,241"                color={t.purple}  t={t} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Packet stream */}
        <div style={s.card}>
          <SectionHeader title="Stream de paquetes" badge="LIVE ●" badgeVariant="live" t={t} />
          <div style={{ fontFamily: "monospace", fontSize: 11, lineHeight: 2, maxHeight: 280, overflow: "hidden" }}>
            {stream.map((p) => (
              <div key={p.id} style={{ borderBottom: `0.5px solid ${t.border}`, padding: "1px 0" }}>
                <span style={{ color: p.alert ? t.danger : t.ok, marginRight: 8 }}>{p.time}</span>
                <span style={{ color: t.text }}>{p.src}</span>
                <span style={{ color: t.text3 }}> → </span>
                <span style={{ color: t.text }}>{p.dst}</span>
                <span style={{ color: t.text3 }}> {p.proto} </span>
                <span style={{ color: p.alert ? t.danger : t.ok, fontWeight: 600 }}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side panels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={s.card}>
            <SectionHeader title="Protocolo breakdown" t={t} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {protocols.map((p) => (
                <div key={p.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: t.text }}>{p.label}</span>
                    <span style={{ fontFamily: "monospace", color: t.text2 }}>{p.val}%</span>
                  </div>
                  <div style={{ height: 6, background: t.bg4, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p.val}%`, background: p.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.card}>
            <SectionHeader title="Top IPs origen" t={t} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topIPs.map((ip) => (
                <div key={ip.ip} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ fontFamily: "monospace", flex: 1, color: t.text }}>{ip.ip}</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: ip.color }}>{ip.hits}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
