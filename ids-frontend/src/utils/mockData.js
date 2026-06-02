export const ALERT_TYPES = [
  { type: "Port Scan",   sid: "1001", sev: "crit", confBase: 95 },
  { type: "SQLi",        sid: "2034", sev: "crit", confBase: 93 },
  { type: "Brute Force", sid: "3017", sev: "high", confBase: 88 },
  { type: "C2 Beacon",   sid: "5211", sev: "crit", confBase: 97 },
  { type: "XSS Attempt", sid: "4092", sev: "med",  confBase: 84 },
  { type: "DoS Flood",   sid: "6001", sev: "high", confBase: 89 },
  { type: "DNS Tunnel",  sid: "7012", sev: "high", confBase: 86 },
];

const IP_SRCS = ["192.168.1.", "203.0.113.", "198.51.100.", "172.16.0.", "10.10.0."];
const IP_DSTS = ["10.0.0.", "192.168.0.", "172.31.0."];

function randIp(base) {
  return base + (Math.floor(Math.random() * 250) + 2);
}

export function randAlert() {
  const t = ALERT_TYPES[Math.floor(Math.random() * ALERT_TYPES.length)];
  return {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString("es-BO", { hour12: false }),
    src: randIp(IP_SRCS[Math.floor(Math.random() * IP_SRCS.length)]),
    dst: randIp(IP_DSTS[Math.floor(Math.random() * IP_DSTS.length)]),
    ...t,
    conf: +(t.confBase + (Math.random() * 6 - 3)).toFixed(1),
    acknowledged: false,
  };
}

export const INITIAL_ALERTS = Array.from({ length: 14 }, (_, i) => {
  const a = randAlert();
  const m = 14 - i;
  a.time = new Date(Date.now() - m * 45000).toLocaleTimeString("es-BO", { hour12: false });
  return a;
});

export const INITIAL_RULES = [
  { id: 1, sid: "1001", name: "Port scan TCP SYN flood",  proto: "tcp", port: "any",    pri: 1, enabled: true,  hits: 847 },
  { id: 2, sid: "2034", name: "SQL injection HTTP",        proto: "tcp", port: "80,443", pri: 1, enabled: true,  hits: 312 },
  { id: 3, sid: "3017", name: "SSH brute force",           proto: "tcp", port: "22",     pri: 2, enabled: true,  hits: 218 },
  { id: 4, sid: "4092", name: "XSS payload in request",   proto: "tcp", port: "80",     pri: 2, enabled: false, hits: 94  },
  { id: 5, sid: "5211", name: "C2 beacon pattern",        proto: "tcp", port: "any",    pri: 1, enabled: true,  hits: 61  },
  { id: 6, sid: "6001", name: "UDP flood detection",       proto: "udp", port: "any",    pri: 2, enabled: true,  hits: 29  },
  { id: 7, sid: "7012", name: "DNS tunneling attempt",     proto: "udp", port: "53",     pri: 2, enabled: true,  hits: 17  },
];

export const STREAM_PACKETS = [
  { src: "192.168.1.1",   dst: "10.0.0.1",  proto: "TCP:80",  status: "CLEAN",          alert: false },
  { src: "203.0.113.42",  dst: "10.0.0.15", proto: "TCP:22",  status: "ALERT SID:3017", alert: true  },
  { src: "10.0.0.88",     dst: "8.8.8.8",   proto: "UDP:53",  status: "CLEAN",          alert: false },
  { src: "198.51.100.7",  dst: "10.0.0.22", proto: "TCP:80",  status: "ALERT SID:2034", alert: true  },
  { src: "172.16.0.5",    dst: "10.0.0.3",  proto: "TCP:443", status: "CLEAN",          alert: false },
  { src: "10.10.0.44",    dst: "10.0.0.1",  proto: "TCP:SYN", status: "ALERT SID:1001", alert: true  },
  { src: "192.168.1.200", dst: "10.0.0.1",  proto: "ICMP",    status: "CLEAN",          alert: false },
];
