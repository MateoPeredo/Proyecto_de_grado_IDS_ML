"""
Motor de captura del IDS.

Captura paquetes con Scapy en una interfaz de red, extrae la información de
comportamiento (sin payload), la pasa al Detector, y guarda las alertas
resultantes en MySQL.

Requiere privilegios de root y la interfaz en modo promiscuo (un IDS observa todo el tráfico del segmento, no solo el dirigido a él).

USO (desde la carpeta ids-backend, como root):
    python -m app.engine.motor --interfaz eth0
    python -m app.engine.motor --interfaz br-xxxx   # interfaz bridge del laboratorio

Si no se indica interfaz, intenta leerla de la config del IDS (tabla config).
"""
import argparse
import os
import time
import logging

from app.db.mysql import SessionLocal


def _segmento_actual() -> str:
    """Segmento que vigila este sensor (etiqueta para alertas y métricas).
    Se define con la variable de entorno IDS_SEGMENTO (default 'datos')."""
    return os.environ.get("IDS_SEGMENTO", "datos")
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
        ml_validado = False
        ml_estado = "sin_ml"           # sin_ml | confirmado | no_concluyente
        ml_confianza = None
        ml_clase = None
        if ml and ml.get("disponible"):
            conf = ml.get("confianza")
            conf_txt = f"{conf*100:.0f}%" if conf is not None else "s/d"
            descripcion += (
                f" | ML: {ml.get('clase')} (confianza {conf_txt}) "
                f"[{ml.get('modelo')}]"
            )
            detected_by = "firma+ml"   # pasó por las dos etapas
            ml_confianza = int(round(conf * 100)) if conf is not None else None
            ml_clase = ml.get("clase")
            if ml.get("es_ataque"):
                # El ML CONFIRMA el ataque: las dos etapas coinciden.
                ml_validado = True
                ml_estado = "confirmado"
            else:
                # El ML cree benigno pero no superó el umbral de veto: la alerta
                # se conservó por la firma. NO es una validación del ML.
                ml_validado = False
                ml_estado = "no_concluyente"

        registro = Alert(
            timestamp=datetime.now(),   # hora local (según TZ del contenedor)
            signature_name=alerta["signature_name"],
            severity=alerta["severity"],
            source_ip=alerta.get("source_ip"),
            dest_ip=alerta.get("dest_ip"),
            protocol=alerta.get("protocol"),
            description=descripcion,
            detected_by=detected_by,
            segmento=_segmento_actual(),
            ml_validado=ml_validado,
            ml_estado=ml_estado,
            ml_confianza=ml_confianza,
            ml_clase=ml_clase,
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
    segmento = _segmento_actual()
    print(f"[motor] {len(firmas)} firmas cargadas. Escuchando en {interfaz} "
          f"(segmento: {segmento})...")

    # Agregador de tráfico para el gráfico verde/rojo (corre en su propio hilo)
    agregador = AgregadorTrafico(flush_segundos=flush_trafico, segmento=segmento)
    agregador.iniciar()
    print(f"[motor] registrando tráfico en ClickHouse cada {flush_trafico}s")

    # Latido en hilo INDEPENDIENTE: el sensor marca que está vivo cada 10s
    # pase lo que pase, aunque su segmento no tenga tráfico. Así el panel del
    # front muestra "activo" a todo sensor encendido (antes el latido dependía
    # de recibir paquetes, y los segmentos tranquilos aparecían "inactivo").
    import threading
    def _bucle_latido():
        from app.engine.latido import latir
        while True:
            try:
                latir(segmento, interfaz)
            except Exception:
                pass
            time.sleep(10)
    threading.Thread(target=_bucle_latido, daemon=True).start()

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

    estado = {"ultima_recarga": time.time(), "ultima_recarga_modelo": time.time(),
              "ultimo_latido": time.time()}

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
        # Rastreo para el gráfico: distinguir ataques reales de falsos positivos.
        _hubo_confirmada = False   # al menos una alerta se conservó (ataque real)
        _hubo_descartada = False   # al menos una alerta la descartó el ML (falso +)
        for alerta in alertas:
            # ETAPA 2 — Verificación ML: siempre que haya modelo activo
            ml_resultado = None
            if verificador.disponible():
                features = constructor.features_para(
                    alerta.get("source_ip"), alerta.get("dest_ip")
                )
                if features is not None:
                    ml_resultado = verificador.verificar(features)
                else:
                    # Hay modelo, pero el constructor no tiene el flujo de ese par
                    # de IPs (flujo muy corto o ya expirado). Lo dejamos trazado
                    # para saber por qué esta alerta no pasó por el modelo.
                    print(f"[ML] sin features del flujo {alerta.get('source_ip')} -> "
                          f"{alerta.get('dest_ip')}: la alerta se guarda solo con firma")
                    try:
                        from app.db.elastic import log_deteccion
                        log_deteccion(
                            motor="firma", resultado="sin_verificar",
                            detalle=(f"{alerta['signature_name']}: no había flujo para "
                                     f"verificar con ML ({alerta.get('source_ip')} -> "
                                     f"{alerta.get('dest_ip')})"),
                        )
                    except Exception:
                        pass

            # Decisión del double-check (con UMBRAL DE VETO):
            # - El ML solo descarta un falso positivo si está MUY seguro de que es
            #   benigno (confianza >= ML_UMBRAL_VETO, por defecto 0.90). Si duda,
            #   gana la firma y la alerta SE CONSERVA. Esto evita que el ML vete
            #   ataques de volumen (fuerza bruta / DoS), cuyos flujos individuales
            #   parecen benignos aunque el patrón agregado sea un ataque.
            # - Sin confianza disponible NO se descarta (no se puede vetar a ciegas).
            # - Ajustable por entorno (ML_UMBRAL_VETO) sin reconstruir la imagen.
            _umbral_veto = float(os.environ.get("ML_UMBRAL_VETO", "0.90"))
            _conf_ml = ml_resultado.get("confianza") if ml_resultado else None
            if (ml_resultado and ml_resultado.get("disponible")
                    and not ml_resultado.get("es_ataque")
                    and _conf_ml is not None and _conf_ml >= _umbral_veto):
                conf = ml_resultado.get("confianza")
                conf_txt = f"{conf*100:.0f}%" if conf is not None else "s/d"
                print(f"[DESCARTADA] {alerta['signature_name']} | "
                      f"{alerta['source_ip']} -> {alerta['dest_ip']} "
                      f"| ML dice BENIGN ({conf_txt}) >= umbral {_umbral_veto:.0%}: falso positivo")
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
                # Falso positivo: NO se guarda la alerta. Se marca como descartada;
                # el conteo para el gráfico (línea azul) se hace al final, una sola
                # vez por paquete, para no contarlo también como malicioso (rojo).
                _hubo_descartada = True
                continue

            # Confirmada (por ML o sin ML disponible): guardar
            _hubo_confirmada = True   # ataque real: cuenta como malicioso (rojo)
            alerta["ml"] = ml_resultado
            # Redactar la etiqueta segun lo que REALMENTE pasó, sin contradicciones:
            #  - ML dice ataque            -> "ML confirma: <clase> (NN%)"
            #  - ML dice BENIGN pero <umbral-> "ML no concluyente (BENIGN NN%): se conserva por firma"
            #  - sin ML / sin flujo        -> "sin verificación ML"
            etiqueta_ml = " | sin verificación ML"
            if ml_resultado and ml_resultado.get("disponible"):
                conf = ml_resultado.get("confianza")
                conf_txt = f"{conf*100:.0f}%" if conf is not None else "s/d"
                if ml_resultado.get("es_ataque"):
                    etiqueta_ml = f" | ML confirma: {ml_resultado.get('clase')} ({conf_txt})"
                else:
                    etiqueta_ml = (f" | ML no concluyente (BENIGN {conf_txt} < umbral "
                                   f"{_umbral_veto:.0%}): se conserva por firma")
            print(f"[ALERTA] {alerta['signature_name']} | "
                  f"{alerta['source_ip']} -> {alerta['dest_ip']}{etiqueta_ml}")
            guardar_alerta(alerta)

            # Notificación por correo (con anti-avalancha). El tipo de ataque
            # se deriva de la FIRMA que disparó (no del ML), porque la firma sabe
            # con certeza qué tipo de ataque es. Se mapea el tipo técnico de la
            # firma (syn_flood, brute_force...) a las categorías de las reglas de
            # notificación (DoS, BruteForce, PortScan).
            try:
                _MAPEO_TIPO = {
                    "syn_flood": "DoS", "icmp_flood": "DoS", "udp_flood": "DoS",
                    "conn_flood": "DoS", "ping_of_death": "DoS", "land_attack": "DoS",
                    "brute_force": "BruteForce",
                    "port_scan": "PortScan", "null_scan": "PortScan",
                    "fin_scan": "PortScan", "xmas_scan": "PortScan",
                    "udp_scan": "PortScan", "ping_sweep": "PortScan",
                }
                _tipo_firma = str(alerta.get("tipo_ataque", "")).lower()
                # tipo_ataque queda como la CATEGORÍA (para las reglas). Si el tipo
                # de firma no está en el mapeo, se conserva el original.
                alerta["tipo_ataque"] = _MAPEO_TIPO.get(_tipo_firma, alerta.get("tipo_ataque", ""))
                from app.services.notificador import despachar_notificaciones
                despachar_notificaciones(alerta)
            except Exception as e:
                print(f"[notif] no se pudo despachar: {e}")

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

        # Tráfico para el gráfico:
        #  - malicioso (rojo)   : SOLO si hubo una alerta confirmada (ataque real)
        #  - descartado (azul)  : si el ML descartó la alerta (falso positivo)
        #  - normal (verde)     : si no disparó ninguna firma
        # Un falso positivo cuenta como descartado, NO como malicioso (antes se
        # contaba en las dos líneas y el rojo subía sin ser un ataque).
        agregador.registrar(info.protocolo, info.size,
                            malicioso=_hubo_confirmada,
                            descartado=(_hubo_descartada and not _hubo_confirmada))

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


def _leer_config():
    """
    Lee la configuración del IDS desde la tabla `config` en MySQL. Devuelve un
    diccionario con las claves de CONFIG_DEFAULTS, completando con los valores
    por defecto las que aún no estén guardadas. Así los parámetros que el usuario
    ajusta en la pantalla de Configuración tienen efecto real sobre el motor.
    """
    try:
        from app.db.mysql import SessionLocal
        from app.models.config import Config, CONFIG_DEFAULTS
        db = SessionLocal()
        try:
            cfg = {f.clave: f.valor for f in db.query(Config).all()}
        finally:
            db.close()
        for k, v in CONFIG_DEFAULTS.items():
            cfg.setdefault(k, v)
        return cfg
    except Exception as e:
        print(f"[motor] No se pudo leer la config de MySQL ({e}); uso valores por defecto.")
        from app.models.config import CONFIG_DEFAULTS
        return dict(CONFIG_DEFAULTS)


def main():
    parser = argparse.ArgumentParser(description="Motor de captura del IDS")
    # Cada sensor vigila su propio segmento, por eso la interfaz es obligatoria y
    # se define por sensor en el despliegue (docker-compose). Lo que SÍ se lee de
    # la configuración global de la app son parámetros comunes a todos los
    # sensores: el nivel de log y la acción al detectar.
    parser.add_argument("--interfaz", "-i", required=True,
                        help="Interfaz de red a capturar (ej. br-datos, br-wifi). Propia de cada sensor.")
    parser.add_argument("--recargar-cada", type=int, default=60, help="Segundos entre recargas de firmas")
    args = parser.parse_args()

    cfg = _leer_config()
    # Nivel de log global: ajusta el detalle de la salida del motor (no afecta la detección).
    nivel = str(cfg.get("deteccion_log_level", "info")).upper()
    logging.basicConfig(level=getattr(logging, nivel, logging.INFO),
                        format="[motor] %(levelname)s: %(message)s")
    accion = cfg.get("deteccion_accion", "alertar_registrar")
    print(f"[motor] Config global -> accion={accion} | log={nivel}")

    iniciar(args.interfaz, args.recargar_cada)


if __name__ == "__main__":
    main()