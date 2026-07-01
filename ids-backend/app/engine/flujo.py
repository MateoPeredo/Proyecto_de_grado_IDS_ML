"""
Constructor de flujo para la segunda etapa (verificación ML).

CORREGIDO para que las features coincidan con CIC-IDS2017 / CICFlowMeter, que es
como se entrenó el modelo. La versión anterior agrupaba TODO el tráfico entre dos
IPs en un solo "flujo" gigante, lo que disparaba los conteos (SYN, ACK, paquetes)
a valores que el modelo nunca vio en entrenamiento -> todo caía en BENIGN.

Claves del enfoque correcto (igual que CICFlowMeter):
- Un flujo = UNA conexión, identificada por la 5-tupla
  (ip_orig, puerto_orig, ip_dest, puerto_dest, protocolo).
- "Fwd" = sentido del que ABRE la conexión (el del SYN inicial); si no se vio el
  SYN, se usa el puerto efímero más alto como heurística de "cliente".
- Timeout de inactividad: un flujo sin paquetes por > timeout se cierra; si la
  misma 5-tupla reaparece, es un flujo NUEVO (no se funde con el anterior).
- Las flags se cuentan por flujo, pero como cada flujo es UNA conexión corta,
  SYN/ACK Count quedan en el rango chico que el modelo aprendió (0-2), no 500.

Unidades (coinciden con CIC-IDS2017):
- Flow Duration y Flow IAT Mean en MICROSEGUNDOS.
- Flow Bytes/s y Flow Packets/s por SEGUNDO.
"""
import time
from collections import deque
from dataclasses import dataclass, field

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
    """Estadísticas de UNA conexión (una 5-tupla)."""
    inicio: float
    ultimo: float
    # quién es "fwd" (cliente): ip y puerto de origen del flujo
    fwd_ip: str = ""
    fwd_port: int = 0
    dst_port: int = 0
    fwd_paquetes: int = 0
    bwd_paquetes: int = 0
    fwd_bytes: int = 0
    bwd_bytes: int = 0
    fwd_tam: list = field(default_factory=list)
    bwd_tam: list = field(default_factory=list)
    max_tam: int = 0
    min_tam: int = 0
    syn: int = 0
    ack: int = 0
    ts_paquetes: deque = field(default_factory=deque)


class ConstructorFlujo:
    """
    Acumula flujos por 5-tupla y entrega las 15 features cuando se piden.
    `features_para(origen, destino)` devuelve el flujo MÁS RECIENTE entre esas
    dos IPs (en un ataque hay muchas conexiones cortas; la última es representativa).
    """

    def __init__(self, ventana_segundos: int = 120, max_flujos: int = 20000):
        self.timeout = ventana_segundos
        self.max_flujos = max_flujos
        self.flujos: dict[tuple, _Flujo] = {}
        self._ultima_limpieza = time.time()

    @staticmethod
    def _clave_5tupla(info) -> tuple:
        """5-tupla canónica: ordena los dos extremos para que ambos sentidos
        del mismo flujo caigan en la misma clave."""
        a = (info.src_ip, info.src_port or 0)
        b = (info.dst_ip, info.dst_port or 0)
        lo, hi = (a, b) if a <= b else (b, a)
        return (lo[0], lo[1], hi[0], hi[1], info.protocolo)

    @staticmethod
    def _es_apertura(info) -> bool:
        """¿Este paquete es el SYN que abre la conexión? (SYN sin ACK)."""
        return "S" in info.flags and "A" not in info.flags

    def registrar(self, info) -> None:
        ahora = info.ts
        clave = self._clave_5tupla(info)
        flujo = self.flujos.get(clave)

        # ¿flujo nuevo, o el anterior ya expiró (misma 5-tupla reusada)?
        if flujo is None or (ahora - flujo.ultimo) > self.timeout:
            flujo = _Flujo(inicio=ahora, ultimo=ahora, dst_port=info.dst_port or 0)
            # Fijar el "fwd" (cliente):
            if self._es_apertura(info):
                # el SYN viene del cliente -> fwd = origen del SYN
                flujo.fwd_ip, flujo.fwd_port = info.src_ip, info.src_port or 0
                flujo.dst_port = info.dst_port or 0
            else:
                # no vimos el SYN: heurística -> el puerto efímero más ALTO es el cliente
                sp, dp = info.src_port or 0, info.dst_port or 0
                if sp >= dp:
                    flujo.fwd_ip, flujo.fwd_port, flujo.dst_port = info.src_ip, sp, dp
                else:
                    flujo.fwd_ip, flujo.fwd_port, flujo.dst_port = info.dst_ip, dp, sp
            self.flujos[clave] = flujo

        flujo.ultimo = ahora
        es_fwd = (info.src_ip == flujo.fwd_ip and (info.src_port or 0) == flujo.fwd_port)
        if es_fwd:
            flujo.fwd_paquetes += 1
            flujo.fwd_bytes += info.size
            flujo.fwd_tam.append(info.size)
        else:
            flujo.bwd_paquetes += 1
            flujo.bwd_bytes += info.size
            flujo.bwd_tam.append(info.size)

        if info.size > flujo.max_tam:
            flujo.max_tam = info.size
        if flujo.min_tam == 0 or info.size < flujo.min_tam:
            flujo.min_tam = info.size

        if "S" in info.flags:
            flujo.syn += 1
        if "A" in info.flags:
            flujo.ack += 1

        flujo.ts_paquetes.append(ahora)
        if len(flujo.ts_paquetes) > 1000:
            flujo.ts_paquetes.popleft()

        if ahora - self._ultima_limpieza > 10:
            self._limpiar(ahora)

    def _limpiar(self, ahora: float) -> None:
        limite = ahora - self.timeout
        viejos = [k for k, f in self.flujos.items() if f.ultimo < limite]
        for k in viejos:
            self.flujos.pop(k, None)
        if len(self.flujos) > self.max_flujos:
            ordenados = sorted(self.flujos.items(), key=lambda kv: kv[1].ultimo)
            for k, _ in ordenados[: len(self.flujos) - self.max_flujos]:
                self.flujos.pop(k, None)
        self._ultima_limpieza = ahora

    def _features_de(self, flujo: _Flujo) -> dict:
        dur_seg = max(flujo.ultimo - flujo.inicio, 1e-6)
        dur_us = dur_seg * 1_000_000
        total_pkts = flujo.fwd_paquetes + flujo.bwd_paquetes
        total_bytes = flujo.fwd_bytes + flujo.bwd_bytes
        fwd_mean = (sum(flujo.fwd_tam) / len(flujo.fwd_tam)) if flujo.fwd_tam else 0.0
        bwd_mean = (sum(flujo.bwd_tam) / len(flujo.bwd_tam)) if flujo.bwd_tam else 0.0
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

    def features_para(self, ip_origen: str, ip_destino: str) -> dict | None:
        """
        Devuelve las 15 features del flujo MÁS RECIENTE entre estas dos IPs.
        (En un ataque hay muchas conexiones cortas con la misma pareja de IPs;
        la más reciente es representativa del patrón que disparó la firma.)
        """
        candidatos = [
            f for (a_ip, _ap, b_ip, _bp, _proto), f in self.flujos.items()
            if {a_ip, b_ip} == {ip_origen, ip_destino}
        ]
        if not candidatos:
            return None
        flujo = max(candidatos, key=lambda f: f.ultimo)   # el más reciente
        return self._features_de(flujo)