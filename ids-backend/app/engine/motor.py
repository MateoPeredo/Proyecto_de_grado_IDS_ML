"""
Motor de captura del IDS.

Captura paquetes con Scapy en una interfaz de red, extrae la información de
comportamiento (sin payload), la pasa al Detector, y guarda las alertas
resultantes en MySQL.

Requiere privilegios de root y la interfaz en modo promiscuo (un IDS observa
TODO el tráfico del segmento, no solo el dirigido a él).

USO (desde la carpeta ids-backend, como root):
    python -m app.engine.motor --interfaz eth0
    python -m app.engine.motor --interfaz br-xxxx   # interfaz bridge del laboratorio

Si no se indica interfaz, intenta leerla de la config del IDS (tabla config).
"""
import argparse
import time

from app.db.mysql import SessionLocal
from app.models.ids_signature import IDSSignature
from app.models.alert import Alert
from app.engine.detector import Detector, Firma, PaqueteInfo
from app.engine.flujo import ConstructorFlujo
from app.ml.verificador import VerificadorML
from app.ml import gestor


def cargar_firmas() -> list[Firma]:
    """Lee las firmas activas desde MySQL y las convierte a objetos Firma."""
    db = SessionLocal()
    try:
        filas = db.query(IDSSignature).filter(IDSSignature.enabled == True).all()
        return [
            Firma(
                id=f.id, nombre=f.nombre, tipo_firma=f.tipo_firma,
                severidad=f.severidad, umbral=f.umbral,
                ventana_segundos=f.ventana_segundos, track_by=f.track_by,
                puerto=f.puerto, protocolo=f.protocolo,
            )
            for f in filas
        ]
    finally:
        db.close()


def guardar_alerta(alerta: dict):
    """Inserta una alerta detectada en la tabla alerts de MySQL."""
    from datetime import datetime
    db = SessionLocal()
    try:
        # Si el ML verificó la alerta, lo anexamos a la descripción y al detected_by
        descripcion = alerta.get("description", "")
        ml = alerta.get("ml")
        detected_by = alerta.get("detected_by", "firma")
        if ml and ml.get("disponible"):
            conf = ml.get("confianza")
            conf_txt = f"{conf*100:.0f}%" if conf is not None else "s/d"
            descripcion += (
                f" | ML: {ml.get('clase')} (confianza {conf_txt}) "
                f"[{ml.get('modelo')}]"
            )
            detected_by = "firma+ml"   # confirmada por las dos etapas

        registro = Alert(
            timestamp=datetime.now(),   # hora local (según TZ del contenedor)
            signature_name=alerta["signature_name"],
            severity=alerta["severity"],
            source_ip=alerta.get("source_ip"),
            dest_ip=alerta.get("dest_ip"),
            protocol=alerta.get("protocol"),
            description=descripcion,
            detected_by=detected_by,
        )
        db.add(registro)
        db.commit()
    except Exception as e:
        print(f"[motor] no se pudo guardar la alerta: {e}")
    finally:
        db.close()


def _flags_a_str(tcp_layer) -> str:
    """Convierte las flags TCP de Scapy a una cadena tipo 'S', 'FPU', '' (NULL)."""
    # Mapa de flags de Scapy a letras
    f = tcp_layer.flags
    resultado = ""
    if f & 0x02: resultado += "S"   # SYN
    if f & 0x01: resultado += "F"   # FIN
    if f & 0x08: resultado += "P"   # PSH
    if f & 0x20: resultado += "U"   # URG
    if f & 0x10: resultado += "A"   # ACK
    if f & 0x04: resultado += "R"   # RST
    return resultado


def paquete_a_info(pkt) -> PaqueteInfo | None:
    """Extrae PaqueteInfo de un paquete Scapy. Devuelve None si no es IP."""
    # import local para que el módulo se pueda importar sin scapy instalado
    from scapy.layers.inet import IP, TCP, UDP, ICMP

    if IP not in pkt:
        return None

    ip = pkt[IP]
    src_ip, dst_ip = ip.src, ip.dst
    src_port = dst_port = None
    flags = ""
    proto = "otro"

    if TCP in pkt:
        proto = "tcp"
        src_port = int(pkt[TCP].sport)
        dst_port = int(pkt[TCP].dport)
        flags = _flags_a_str(pkt[TCP])
    elif UDP in pkt:
        proto = "udp"
        src_port = int(pkt[UDP].sport)
        dst_port = int(pkt[UDP].dport)
    elif ICMP in pkt:
        proto = "icmp"
    else:
        return None  # solo nos interesan tcp/udp/icmp

    return PaqueteInfo(
        ts=time.time(), src_ip=src_ip, dst_ip=dst_ip,
        src_port=src_port, dst_port=dst_port,
        protocolo=proto, flags=flags, size=len(pkt),
    )


def iniciar(interfaz: str, recargar_cada: int = 60, flush_trafico: int = 2):
    """
    Bucle principal: captura en `interfaz` y procesa cada paquete.
    - Detecta ataques con las firmas (guarda alertas en MySQL).
    - Acumula conteos de tráfico y los vuelca a ClickHouse cada flush_trafico s.
    Recarga las firmas desde la BD cada `recargar_cada` segundos.
    """
    from scapy.all import sniff
    from app.engine.agregador import AgregadorTrafico

    firmas = cargar_firmas()
    if not firmas:
        print("[motor] ADVERTENCIA: no hay firmas activas en la BD.")
    detector = Detector(firmas)
    print(f"[motor] {len(firmas)} firmas cargadas. Escuchando en {interfaz}...")

    # Agregador de tráfico para el gráfico verde/rojo (corre en su propio hilo)
    agregador = AgregadorTrafico(flush_segundos=flush_trafico)
    agregador.iniciar()
    print(f"[motor] registrando tráfico en ClickHouse cada {flush_trafico}s")

    # ── Segunda etapa: constructor de flujo + verificador ML ─────────────────
    # El constructor acumula estadísticas de cada flujo para poder calcular las
    # 15 features cuando una firma dispara. El verificador carga el modelo activo.
    constructor = ConstructorFlujo(ventana_segundos=120)
    ruta_modelo = gestor.ruta_activo()
    verificador = VerificadorML(ruta_modelo or "")
    if verificador.disponible():
        print(f"[motor] modelo ML activo: {verificador.info().get('nombre_modelo')}")
    else:
        print("[motor] sin modelo ML activo: las alertas de firma se guardan sin verificación.")

    estado = {"ultima_recarga": time.time(), "ultima_recarga_modelo": time.time()}

    def manejar(pkt):
        # recargar firmas periódicamente (por si se editaron en la BD)
        if time.time() - estado["ultima_recarga"] > recargar_cada:
            detector.actualizar_firmas(cargar_firmas())
            estado["ultima_recarga"] = time.time()

        # recargar el modelo activo periódicamente (por si el usuario lo cambió)
        if time.time() - estado["ultima_recarga_modelo"] > 30:
            ruta = gestor.ruta_activo()
            if ruta != verificador.ruta_modelo:
                verificador.recargar(ruta or "")
                if verificador.disponible():
                    print(f"[motor] modelo ML recargado: {verificador.info().get('nombre_modelo')}")
            estado["ultima_recarga_modelo"] = time.time()

        info = paquete_a_info(pkt)
        if info is None:
            return

        # Acumular el paquete en el constructor de flujo (para la 2da etapa)
        constructor.registrar(info)

        # ETAPA 1 — Detección por firmas: ¿este paquete dispara alguna alerta?
        alertas = detector.procesar(info)
        for alerta in alertas:
            # ETAPA 2 — Verificación ML: solo si hay modelo activo
            ml_resultado = None
            if verificador.disponible():
                features = constructor.features_para(
                    alerta.get("source_ip"), alerta.get("dest_ip")
                )
                if features is not None:
                    ml_resultado = verificador.verificar(features)

            # Decisión del double-check:
            # - Si el ML está disponible y dice BENIGN -> es falso positivo: DESCARTAR
            # - Si el ML confirma ataque, o no hay ML/flujo -> CONSERVAR la alerta
            if ml_resultado and ml_resultado.get("disponible") and not ml_resultado.get("es_ataque"):
                conf = ml_resultado.get("confianza")
                conf_txt = f"{conf*100:.0f}%" if conf is not None else "s/d"
                print(f"[DESCARTADA] {alerta['signature_name']} | "
                      f"{alerta['source_ip']} -> {alerta['dest_ip']} "
                      f"| ML dice BENIGN ({conf_txt}): falso positivo")
                # Log de la decisión de descarte (opcional, no rompe si falla)
                try:
                    from app.db.elastic import log_deteccion
                    log_deteccion(
                        motor="firma+ml", resultado="descartada",
                        detalle=(f"{alerta['signature_name']} descartada por ML "
                                 f"(BENIGN {conf_txt}): {alerta['source_ip']}"),
                    )
                except Exception:
                    pass
                # Falso positivo: NO se guarda la alerta
                continue

            # Confirmada (por ML o sin ML disponible): guardar
            alerta["ml"] = ml_resultado
            etiqueta_ml = ""
            if ml_resultado and ml_resultado.get("disponible"):
                conf = ml_resultado.get("confianza")
                conf_txt = f"{conf*100:.0f}%" if conf is not None else "s/d"
                etiqueta_ml = f" | ML confirma: {ml_resultado.get('clase')} ({conf_txt})"
            print(f"[ALERTA] {alerta['signature_name']} | "
                  f"{alerta['source_ip']} -> {alerta['dest_ip']}{etiqueta_ml}")
            guardar_alerta(alerta)

            # Notificación por correo (con anti-avalancha). El tipo de ataque
            # se toma de la clase del ML si está disponible; si no, queda "any".
            try:
                if ml_resultado and ml_resultado.get("disponible"):
                    alerta["tipo_ataque"] = ml_resultado.get("clase", "")
                from app.services.notificador import despachar_notificaciones
                despachar_notificaciones(alerta)
            except Exception:
                pass

            # Log de detección a Elasticsearch
            try:
                from app.db.elastic import log_deteccion, log_trafico
                log_deteccion(
                    motor="firma+ml" if (ml_resultado and ml_resultado.get("disponible")) else "firma",
                    resultado="malicioso",
                    detalle=f"{alerta['signature_name']}: {alerta['source_ip']} -> {alerta['dest_ip']}{etiqueta_ml}",
                )
                log_trafico(
                    ip_origen=info.src_ip, ip_destino=info.dst_ip,
                    protocolo=info.protocolo, clasificacion="malicioso",
                    puerto_origen=info.src_port, puerto_destino=info.dst_port,
                    bytes_=info.size,
                )
            except Exception:
                pass

        # Tráfico: malicioso si disparó alerta, normal si no
        agregador.registrar(info.protocolo, info.size, malicioso=bool(alertas))

        # Log de tráfico NORMAL muestreado (1 de cada N) para búsqueda sin saturar ES.
        if not alertas:
            estado["contador_pkt"] = estado.get("contador_pkt", 0) + 1
            if estado["contador_pkt"] % 50 == 0:  # 1 de cada 50 paquetes normales
                try:
                    from app.db.elastic import log_trafico
                    log_trafico(
                        ip_origen=info.src_ip, ip_destino=info.dst_ip,
                        protocolo=info.protocolo, clasificacion="normal",
                        puerto_origen=info.src_port, puerto_destino=info.dst_port,
                        bytes_=info.size,
                    )
                except Exception:
                    pass

    # store=False: no acumula paquetes en memoria (importante para captura continua)
    sniff(iface=interfaz, prn=manejar, store=False)


def main():
    parser = argparse.ArgumentParser(description="Motor de captura del IDS")
    parser.add_argument("--interfaz", "-i", required=True, help="Interfaz de red a capturar (ej. eth0, br-xxxx)")
    parser.add_argument("--recargar-cada", type=int, default=60, help="Segundos entre recargas de firmas")
    args = parser.parse_args()
    iniciar(args.interfaz, args.recargar_cada)


if __name__ == "__main__":
    main()
