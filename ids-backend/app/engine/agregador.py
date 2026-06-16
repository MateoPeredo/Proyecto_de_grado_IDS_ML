"""
Agregador de tráfico para ClickHouse.

El sensor ve miles de paquetes; escribir uno por uno saturaría ClickHouse.
En cambio, este agregador ACUMULA conteos en memoria y los vuelca a la tabla
traffic_raw una vez por ventana de tiempo (flush_segundos).

Criterio: un paquete es "malicioso" si disparó una alerta en este ciclo;
el resto es "normal". Así el gráfico verde/rojo refleja la detección.

Es thread-safe porque el flush corre en un hilo aparte mientras la captura
sigue sumando paquetes.
"""
import threading
import time
from collections import defaultdict


class AgregadorTrafico:
    def __init__(self, flush_segundos: int = 5):
        self.flush_segundos = flush_segundos
        self._lock = threading.Lock()
        self._reset_contadores()
        self._activo = False
        self._hilo: threading.Thread | None = None

    def _reset_contadores(self):
        # Conteos por protocolo: {protocolo: {"packets":, "bytes":, "normales":, "maliciosos":}}
        self._datos = defaultdict(lambda: {"packets": 0, "bytes": 0, "normales": 0, "maliciosos": 0})

    def registrar(self, protocolo: str, size: int, malicioso: bool):
        """Suma un paquete al acumulador (lo llama el motor por cada paquete)."""
        with self._lock:
            d = self._datos[protocolo]
            d["packets"] += 1
            d["bytes"] += size
            if malicioso:
                d["maliciosos"] += 1
            else:
                d["normales"] += 1

    def _tomar_y_resetear(self) -> dict:
        """Devuelve los conteos acumulados y reinicia para la próxima ventana."""
        with self._lock:
            datos = self._datos
            self._reset_contadores()
            return datos

    def iniciar(self):
        """Arranca el hilo que vuelca a ClickHouse cada flush_segundos."""
        self._activo = True
        self._hilo = threading.Thread(target=self._bucle_flush, daemon=True)
        self._hilo.start()

    def detener(self):
        self._activo = False

    def _bucle_flush(self):
        while self._activo:
            time.sleep(self.flush_segundos)
            self._flush()

    def _flush(self):
        """Escribe los conteos acumulados en traffic_raw."""
        datos = self._tomar_y_resetear()
        if not datos:
            return  # nada que escribir en esta ventana

        # import local: solo se necesita al volcar (no al importar el módulo)
        try:
            from app.db.clickhouse import get_client
            from app.config import settings
            from datetime import datetime

            client = get_client()
            ahora = datetime.now()
            filas = []
            for protocolo, d in datos.items():
                filas.append([
                    ahora, d["packets"], d["bytes"],
                    d["normales"], d["maliciosos"], protocolo,
                ])
            if filas:
                client.insert(
                    f"{settings.CLICKHOUSE_DB}.traffic_raw",
                    filas,
                    column_names=["ts", "packets", "bytes", "flujos_normales", "flujos_maliciosos", "protocol"],
                )
        except Exception as e:
            print(f"[trafico] no se pudo escribir en ClickHouse: {e}")
