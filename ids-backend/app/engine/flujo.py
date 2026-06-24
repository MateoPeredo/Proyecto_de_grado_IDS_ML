"""
Constructor de flujo para la segunda etapa (verificación ML).

El detector de firmas trabaja paquete por paquete y no guarda los paquetes.
Pero el modelo de ML necesita CARACTERÍSTICAS DE FLUJO (estadísticas sobre la
conexión completa), no de un paquete suelto. Este módulo resuelve esa brecha:

Mantiene un acumulador ligero por cada flujo (clave: ip_origen->ip_destino),
actualizado con cada paquete. Cuando una firma dispara sobre una IP, podemos
pedirle a este acumulador las 15 características calculadas en tiempo real,
con los mismos nombres y unidades que usó el dataset CIC-IDS2017 para entrenar.

Diseño:
- Sin payload, solo metadatos (coherente con el resto del IDS).
- Ventana deslizante: los flujos viejos se descartan para no crecer en memoria.
- Las 15 features coinciden EXACTAMENTE con las columnas del modelo entrenado.

IMPORTANTE sobre unidades (deben coincidir con CIC-IDS2017 / CICFlowMeter):
- Flow Duration en MICROSEGUNDOS.
- Flow IAT Mean en MICROSEGUNDOS.
- Flow Bytes/s y Flow Packets/s en unidades por SEGUNDO.
- "Fwd" = sentido origen->destino (quien inicia). "Bwd" = destino->origen.
"""
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field


# Las 15 features que el modelo espera, en el orden de referencia.
# (El orden real lo impone el .pkl en 'columnas'; acá es solo documentación.)
FEATURES_MODELO = [
    "Flow Duration", "Total Fwd Packets", "Total Backward Packets",
    "Total Length of Fwd Packets", "Total Length of Bwd Packets",
    "Fwd Packet Length Mean", "Bwd Packet Length Mean",
    "Max Packet Length", "Min Packet Length",
    "Flow Packets/s", "Flow Bytes/s", "Flow IAT Mean",
    "SYN Flag Count", "ACK Flag Count", "Destination Port",
]


@dataclass
class _Flujo:
    """Estadísticas acumuladas de un flujo (una conexión origen->destino)."""
    inicio: float                       # ts del primer paquete (segundos)
    ultimo: float                       # ts del último paquete (segundos)
    # Conteos por sentido
    fwd_paquetes: int = 0
    bwd_paquetes: int = 0
    fwd_bytes: int = 0
    bwd_bytes: int = 0
    # Tamaños (para mean/max/min globales del flujo)
    fwd_tam: list = field(default_factory=list)
    bwd_tam: list = field(default_factory=list)
    max_tam: int = 0
    min_tam: int = 0                    # 0 = aún sin inicializar
    # Banderas TCP
    syn: int = 0
    ack: int = 0
    # Tiempos entre paquetes (IAT) en segundos
    ts_paquetes: deque = field(default_factory=deque)
    dst_port: int = 0


class ConstructorFlujo:
    """
    Acumula flujos y entrega las 15 features cuando se las piden.

    La clave de un flujo es la pareja ordenada (ip_a, ip_b) para agrupar ambos
    sentidos en el mismo flujo. El sentido "fwd" se fija con el primer paquete
    visto (quien habló primero es el "origen").
    """

    def __init__(self, ventana_segundos: int = 120, max_flujos: int = 5000):
        self.ventana = ventana_segundos
        self.max_flujos = max_flujos
        # clave (ip_origen, ip_destino) -> _Flujo
        self.flujos: dict[tuple, _Flujo] = {}
        # para saber el sentido: clave_par -> ip que inició
        self._iniciador: dict[tuple, str] = {}
        self._ultima_limpieza = time.time()

    @staticmethod
    def _clave_par(ip1: str, ip2: str) -> tuple:
        """Clave simétrica para agrupar ambos sentidos del mismo flujo."""
        return tuple(sorted((ip1, ip2)))

    def registrar(self, info) -> None:
        """Actualiza el acumulador con un paquete (PaqueteInfo del detector)."""
        ahora = info.ts
        par = self._clave_par(info.src_ip, info.dst_ip)

        # Determinar quién inició el flujo (primer paquete visto define "fwd")
        if par not in self._iniciador:
            self._iniciador[par] = info.src_ip
            self.flujos[par] = _Flujo(inicio=ahora, ultimo=ahora,
                                      dst_port=info.dst_port or 0)
        flujo = self.flujos[par]
        flujo.ultimo = ahora

        es_fwd = (info.src_ip == self._iniciador[par])
        if es_fwd:
            flujo.fwd_paquetes += 1
            flujo.fwd_bytes += info.size
            flujo.fwd_tam.append(info.size)
        else:
            flujo.bwd_paquetes += 1
            flujo.bwd_bytes += info.size
            flujo.bwd_tam.append(info.size)

        # Tamaños globales
        if info.size > flujo.max_tam:
            flujo.max_tam = info.size
        if flujo.min_tam == 0 or info.size < flujo.min_tam:
            flujo.min_tam = info.size

        # Banderas
        if "S" in info.flags:
            flujo.syn += 1
        if "A" in info.flags:
            flujo.ack += 1

        # IAT: guardar timestamps (limitado para no crecer indefinidamente)
        flujo.ts_paquetes.append(ahora)
        if len(flujo.ts_paquetes) > 1000:
            flujo.ts_paquetes.popleft()

        # Limpieza periódica de flujos viejos
        if ahora - self._ultima_limpieza > 10:
            self._limpiar(ahora)

    def _limpiar(self, ahora: float) -> None:
        """Descarta flujos cuyo último paquete quedó fuera de la ventana."""
        limite = ahora - self.ventana
        viejos = [k for k, f in self.flujos.items() if f.ultimo < limite]
        for k in viejos:
            self.flujos.pop(k, None)
            self._iniciador.pop(k, None)
        # Si aún hay demasiados, quitar los más antiguos
        if len(self.flujos) > self.max_flujos:
            ordenados = sorted(self.flujos.items(), key=lambda kv: kv[1].ultimo)
            for k, _ in ordenados[: len(self.flujos) - self.max_flujos]:
                self.flujos.pop(k, None)
                self._iniciador.pop(k, None)
        self._ultima_limpieza = ahora

    def features_para(self, ip_origen: str, ip_destino: str) -> dict | None:
        """
        Devuelve las 15 features del flujo entre estas dos IPs, o None si no
        hay datos. Las unidades coinciden con CIC-IDS2017.
        """
        par = self._clave_par(ip_origen, ip_destino)
        flujo = self.flujos.get(par)
        if flujo is None:
            return None

        dur_seg = max(flujo.ultimo - flujo.inicio, 1e-6)   # evitar /0
        dur_us = dur_seg * 1_000_000                         # microsegundos

        total_pkts = flujo.fwd_paquetes + flujo.bwd_paquetes
        total_bytes = flujo.fwd_bytes + flujo.bwd_bytes

        fwd_mean = (sum(flujo.fwd_tam) / len(flujo.fwd_tam)) if flujo.fwd_tam else 0.0
        bwd_mean = (sum(flujo.bwd_tam) / len(flujo.bwd_tam)) if flujo.bwd_tam else 0.0

        # IAT medio (tiempo entre paquetes) en microsegundos
        ts = list(flujo.ts_paquetes)
        if len(ts) >= 2:
            difs = [(ts[i] - ts[i - 1]) for i in range(1, len(ts))]
            iat_mean_us = (sum(difs) / len(difs)) * 1_000_000
        else:
            iat_mean_us = 0.0

        return {
            "Flow Duration": dur_us,
            "Total Fwd Packets": flujo.fwd_paquetes,
            "Total Backward Packets": flujo.bwd_paquetes,
            "Total Length of Fwd Packets": flujo.fwd_bytes,
            "Total Length of Bwd Packets": flujo.bwd_bytes,
            "Fwd Packet Length Mean": fwd_mean,
            "Bwd Packet Length Mean": bwd_mean,
            "Max Packet Length": flujo.max_tam,
            "Min Packet Length": flujo.min_tam,
            "Flow Packets/s": total_pkts / dur_seg,
            "Flow Bytes/s": total_bytes / dur_seg,
            "Flow IAT Mean": iat_mean_us,
            "SYN Flag Count": flujo.syn,
            "ACK Flag Count": flujo.ack,
            "Destination Port": flujo.dst_port,
        }
