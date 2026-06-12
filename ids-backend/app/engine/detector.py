"""
Detector de firmas conductuales.

Mantiene contadores por ventana de tiempo deslizante y, según el tipo de firma,
decide si se superó el umbral → genera una alerta.

No inspecciona payload: solo observa comportamiento (flags, conteos, puertos).
Cada tipo de firma tiene su propia lógica de "qué evento contar".
"""
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field


@dataclass
class PaqueteInfo:
    """Información mínima de un paquete que el detector necesita (sin payload)."""
    ts: float
    src_ip: str
    dst_ip: str
    src_port: int | None
    dst_port: int | None
    protocolo: str          # tcp | udp | icmp
    flags: str              # cadena de flags TCP, ej. "S", "FPU", "" (vacío = NULL)
    size: int               # tamaño del paquete en bytes


@dataclass
class Firma:
    """Representación en memoria de una firma de ids_signatures."""
    id: int
    nombre: str
    tipo_firma: str
    severidad: str
    umbral: int
    ventana_segundos: int
    track_by: str           # src | dst
    puerto: int | None
    protocolo: str


@dataclass
class _Ventana:
    """Ventana deslizante de eventos (timestamps, y opcional un set de 'objetivos')."""
    eventos: deque = field(default_factory=deque)        # timestamps de eventos
    objetivos: dict = field(default_factory=dict)        # objetivo -> último ts (para contar distintos)


class Detector:
    """
    Evalúa cada paquete contra las firmas activas y devuelve alertas.

    Para cada firma mantiene contadores agrupados por la clave de seguimiento
    (IP origen o destino). Usa ventanas deslizantes: descarta eventos viejos.
    """

    def __init__(self, firmas: list[Firma]):
        self.firmas = firmas
        # estado[firma_id][clave] = _Ventana
        self.estado: dict[int, dict[str, _Ventana]] = defaultdict(lambda: defaultdict(_Ventana))
        # anti-spam: no repetir la misma alerta para la misma clave dentro de su ventana
        self.ultimo_disparo: dict[tuple, float] = {}

    def actualizar_firmas(self, firmas: list[Firma]):
        """Recarga el catálogo de firmas (si se editaron en la BD)."""
        self.firmas = firmas

    def _flags_coincide(self, firma_tipo: str, p: PaqueteInfo) -> bool:
        """Decide si el paquete es el 'evento' que esta firma cuenta, según flags."""
        f = set(p.flags)
        if firma_tipo == "port_scan":     return p.flags == "S"          # SYN
        if firma_tipo == "syn_flood":     return p.flags == "S"
        if firma_tipo == "conn_flood":    return p.flags == "S"
        if firma_tipo == "null_scan":     return p.flags == ""           # sin flags
        if firma_tipo == "fin_scan":      return p.flags == "F"
        if firma_tipo == "xmas_scan":     return f == {"F", "P", "U"}    # FIN+PSH+URG
        if firma_tipo == "brute_force":   return "S" in f                # intento de conexión
        return True  # tipos que no dependen de flags (floods icmp/udp, etc.)

    def _es_evento(self, firma: Firma, p: PaqueteInfo) -> bool:
        """Determina si el paquete cuenta como evento para esta firma."""
        t = firma.tipo_firma

        # Filtro por protocolo
        if firma.protocolo != "any" and p.protocolo != firma.protocolo:
            return False

        # Filtro por puerto (si la firma especifica uno, ej. brute force SSH=22)
        if firma.puerto is not None and p.dst_port != firma.puerto:
            return False

        # Casos especiales que se evalúan por paquete individual
        if t == "ping_of_death":
            return p.protocolo == "icmp" and p.size > 1500
        if t == "land_attack":
            return p.src_ip == p.dst_ip and p.src_ip != ""

        # Flujos basados en flags TCP
        if t in ("port_scan", "syn_flood", "conn_flood", "null_scan",
                 "fin_scan", "xmas_scan", "brute_force"):
            return p.protocolo == "tcp" and self._flags_coincide(t, p)

        # Floods / sweeps por protocolo
        if t == "icmp_flood":  return p.protocolo == "icmp"
        if t == "ping_sweep":  return p.protocolo == "icmp"
        if t == "udp_flood":   return p.protocolo == "udp"
        if t == "udp_scan":    return p.protocolo == "udp"

        return False

    def _clave(self, firma: Firma, p: PaqueteInfo) -> str:
        return p.src_ip if firma.track_by == "src" else p.dst_ip

    def _cuenta_objetivos_distintos(self, firma: Firma) -> bool:
        """
        Algunas firmas cuentan OBJETIVOS DISTINTOS, no eventos totales:
        - port_scan: puertos distintos
        - ping_sweep / network_scan: IPs distintas
        """
        return firma.tipo_firma in ("port_scan", "ping_sweep", "udp_scan")

    def procesar(self, p: PaqueteInfo) -> list[dict]:
        """
        Procesa un paquete contra todas las firmas activas.
        Devuelve una lista de alertas (dicts) que se dispararon con este paquete.
        """
        alertas = []
        ahora = p.ts

        for firma in self.firmas:
            if not self._es_evento(firma, p):
                continue

            clave = self._clave(firma, p)
            if not clave:
                continue

            ventana = self.estado[firma.id][clave]
            limite = ahora - firma.ventana_segundos

            # Descartar eventos viejos (fuera de la ventana deslizante)
            while ventana.eventos and ventana.eventos[0] < limite:
                ventana.eventos.popleft()

            # Registrar el evento actual
            ventana.eventos.append(ahora)

            # Si la firma cuenta objetivos distintos, llevar registro de cuáles
            if self._cuenta_objetivos_distintos(firma):
                objetivo = p.dst_port if firma.tipo_firma in ("port_scan", "udp_scan") else p.dst_ip
                ventana.objetivos[objetivo] = ahora
                # limpiar objetivos viejos
                viejos = [o for o, t_o in ventana.objetivos.items() if t_o < limite]
                for o in viejos:
                    del ventana.objetivos[o]
                conteo = len(ventana.objetivos)
            else:
                conteo = len(ventana.eventos)

            # ¿Se superó el umbral?
            if conteo >= firma.umbral:
                # anti-spam: no repetir alerta de esta firma+clave dentro de la ventana
                disparo_key = (firma.id, clave)
                ultimo = self.ultimo_disparo.get(disparo_key, 0)
                if ahora - ultimo >= firma.ventana_segundos:
                    self.ultimo_disparo[disparo_key] = ahora
                    alertas.append(self._construir_alerta(firma, p, clave, conteo))

        return alertas

    def _construir_alerta(self, firma: Firma, p: PaqueteInfo, clave: str, conteo: int) -> dict:
        """Arma el dict de alerta listo para guardar en MySQL."""
        # La IP "atacante" es la que rastreamos; la otra es el objetivo
        if firma.track_by == "src":
            source_ip, dest_ip = clave, p.dst_ip
        else:
            source_ip, dest_ip = p.src_ip, clave
        return {
            "signature_name": firma.nombre,
            "severity": firma.severidad,
            "source_ip": source_ip,
            "dest_ip": dest_ip,
            "protocol": p.protocolo,
            "detected_by": "firma",
            "description": (
                f"{firma.nombre}: se detectaron {conteo} eventos en "
                f"{firma.ventana_segundos}s (umbral {firma.umbral})."
            ),
            "tipo_ataque": firma.tipo_firma,
        }
