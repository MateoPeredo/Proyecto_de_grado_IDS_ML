from sqlalchemy import Column, Integer, String, Boolean, DateTime, func

from app.db.mysql import Base


class IDSSignature(Base):
    """
    Firma conductual del IDS. A diferencia de las firmas basadas en payload
    (que inspeccionan el contenido), estas detectan COMPORTAMIENTO: cuentan
    eventos por ventana de tiempo (ej. N paquetes SYN en X segundos).

    El motor lee estas filas, y según `tipo_firma` aplica la lógica de detección
    correspondiente usando los parámetros (umbral, ventana, etc.).
    """
    __tablename__ = "ids_signatures"

    id               = Column(Integer, primary_key=True, index=True)
    nombre           = Column(String(128), nullable=False)
    tipo_firma       = Column(String(32), nullable=False)   # port_scan, syn_flood, brute_force, ...
    severidad        = Column(String(16), default="medium") # low | medium | high | critical
    umbral           = Column(Integer, default=20)          # cuántos eventos disparan la alerta
    ventana_segundos = Column(Integer, default=10)          # en cuánto tiempo
    track_by         = Column(String(8), default="src")     # src | dst (agrupa por IP origen o destino)
    puerto           = Column(Integer, nullable=True)       # puerto específico (ej. 22 SSH), o NULL = cualquiera
    protocolo        = Column(String(8), default="tcp")     # tcp | udp | icmp | any
    enabled          = Column(Boolean, default=True)
    descripcion      = Column(String(255), nullable=True)
    created_at       = Column(DateTime, server_default=func.now())
    updated_at       = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ──────────────────────────────────────────────────────────────────────────────
#  Catálogo de firmas precargadas (15 firmas conductuales).
#  Basadas en reglas estándar de Snort documentadas, reimplementadas sobre
#  análisis de comportamiento (sin inspección de payload).
#  Cada tipo_firma tiene su lógica de detección en el motor (detector.py).
# ──────────────────────────────────────────────────────────────────────────────
SIGNATURES_SEED = [
    # ── Escaneos / reconocimiento ────────────────────────────────────────────
    {"nombre": "Escaneo de puertos SYN (Nmap)", "tipo_firma": "port_scan",
     "severidad": "medium", "umbral": 20, "ventana_segundos": 10, "track_by": "src",
     "puerto": None, "protocolo": "tcp",
     "descripcion": "Una IP envía SYN a muchos puertos distintos (escaneo de puertos)."},

    {"nombre": "Escaneo NULL", "tipo_firma": "null_scan",
     "severidad": "medium", "umbral": 15, "ventana_segundos": 10, "track_by": "src",
     "puerto": None, "protocolo": "tcp",
     "descripcion": "Paquetes TCP sin ninguna flag activa (técnica de evasión)."},

    {"nombre": "Escaneo FIN", "tipo_firma": "fin_scan",
     "severidad": "medium", "umbral": 15, "ventana_segundos": 10, "track_by": "src",
     "puerto": None, "protocolo": "tcp",
     "descripcion": "Paquetes TCP solo con flag FIN (escaneo sigiloso)."},

    {"nombre": "Escaneo XMAS", "tipo_firma": "xmas_scan",
     "severidad": "medium", "umbral": 15, "ventana_segundos": 10, "track_by": "src",
     "puerto": None, "protocolo": "tcp",
     "descripcion": "Paquetes TCP con flags FIN+PSH+URG (escaneo Christmas tree)."},

    {"nombre": "Escaneo UDP", "tipo_firma": "udp_scan",
     "severidad": "low", "umbral": 20, "ventana_segundos": 10, "track_by": "src",
     "puerto": None, "protocolo": "udp",
     "descripcion": "Una IP sondea muchos puertos UDP distintos."},

    {"nombre": "Barrido de red (Ping Sweep)", "tipo_firma": "ping_sweep",
     "severidad": "low", "umbral": 15, "ventana_segundos": 30, "track_by": "src",
     "puerto": None, "protocolo": "icmp",
     "descripcion": "Una IP hace ping a muchas IPs distintas para mapear la red."},

    # ── Denegación de servicio ───────────────────────────────────────────────
    {"nombre": "SYN Flood (DoS)", "tipo_firma": "syn_flood",
     "severidad": "high", "umbral": 50, "ventana_segundos": 10, "track_by": "dst",
     "puerto": None, "protocolo": "tcp",
     "descripcion": "Volumen anormal de paquetes SYN hacia un destino (inundación)."},

    {"nombre": "ICMP Flood", "tipo_firma": "icmp_flood",
     "severidad": "high", "umbral": 100, "ventana_segundos": 5, "track_by": "dst",
     "puerto": None, "protocolo": "icmp",
     "descripcion": "Inundación de paquetes ICMP (ping flood) hacia un destino."},

    {"nombre": "UDP Flood", "tipo_firma": "udp_flood",
     "severidad": "high", "umbral": 100, "ventana_segundos": 10, "track_by": "dst",
     "puerto": None, "protocolo": "udp",
     "descripcion": "Inundación de paquetes UDP hacia un destino."},

    {"nombre": "Ping de la Muerte", "tipo_firma": "ping_of_death",
     "severidad": "high", "umbral": 1, "ventana_segundos": 5, "track_by": "src",
     "puerto": None, "protocolo": "icmp",
     "descripcion": "Paquetes ICMP anormalmente grandes (>1500 bytes)."},

    # ── Fuerza bruta ─────────────────────────────────────────────────────────
    {"nombre": "Fuerza bruta SSH", "tipo_firma": "brute_force",
     "severidad": "high", "umbral": 5, "ventana_segundos": 60, "track_by": "src",
     "puerto": 22, "protocolo": "tcp",
     "descripcion": "Múltiples intentos de conexión al servicio SSH (puerto 22)."},

    {"nombre": "Fuerza bruta FTP", "tipo_firma": "brute_force",
     "severidad": "high", "umbral": 5, "ventana_segundos": 60, "track_by": "src",
     "puerto": 21, "protocolo": "tcp",
     "descripcion": "Múltiples intentos de conexión al servicio FTP (puerto 21)."},

    {"nombre": "Fuerza bruta Telnet", "tipo_firma": "brute_force",
     "severidad": "medium", "umbral": 5, "ventana_segundos": 60, "track_by": "src",
     "puerto": 23, "protocolo": "tcp",
     "descripcion": "Múltiples intentos de conexión al servicio Telnet (puerto 23)."},

    # ── Anomalías de protocolo ───────────────────────────────────────────────
    {"nombre": "Ataque LAND", "tipo_firma": "land_attack",
     "severidad": "high", "umbral": 1, "ventana_segundos": 5, "track_by": "src",
     "puerto": None, "protocolo": "tcp",
     "descripcion": "Paquete con IP origen igual a IP destino (paquete malformado)."},

    {"nombre": "Exceso de conexiones simultáneas", "tipo_firma": "conn_flood",
     "severidad": "medium", "umbral": 80, "ventana_segundos": 10, "track_by": "src",
     "puerto": None, "protocolo": "tcp",
     "descripcion": "Una IP abre demasiadas conexiones en poco tiempo."},
]
