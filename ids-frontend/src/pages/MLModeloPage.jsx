import { useState, useEffect, useRef } from "react";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, SectionHeader } from "../components/ui/SharedUI";
import { mlService } from "../services/api";

export function PageML({ t, role }) {
  const s = useStyles(t);
  const esDesarrollador = role === "developer";   // único que gestiona modelos

  const [info, setInfo]         = useState(null);
  const [modelos, setModelos]   = useState([]);
  const [activo, setActivo]     = useState(null);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [mensaje, setMensaje]   = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef(null);

  // Carga el estado. Espera a que las 3 llamadas terminen (Promise.all) para no
  // mostrar "inactivo" mientras una todavía no respondió. Si el estado viene sin
  // modelo pese a haber modelos en la lista (timing del backend recién arrancado),
  // reintenta una vez tras un momento.
  const cargar = async (opts = {}) => {
    // fondo=true: es un refresco automático o reintento; NO muestra errores ni
    // spinner (para no molestar). intento: nº de reintento actual.
    const { fondo = false, intento = 0 } = opts;
    try {
      const [resMetrics, resModelos, resStats] = await Promise.all([
        mlService.getMetrics().catch(() => null),
        mlService.listarModelos().catch(() => null),
        mlService.getModelStats().catch(() => null),
      ]);

      const metrics = resMetrics?.data || null;
      const lista   = resModelos?.data?.modelos || [];
      const act     = resModelos?.data?.activo || null;

      // Lectura prematura: el backend dice "no entrenado" pero hay modelo activo
      // registrado (típico con la VM lenta o el backend recién arrancado).
      // Reintenta hasta 5 veces, esperando cada vez un poco más. No baja loading
      // ni muestra error mientras reintenta: la info previa (si hay) sigue en pantalla.
      const lecturaPrematura = (!metrics || !metrics.trained) && act;
      if (lecturaPrematura && intento < 5) {
        setTimeout(() => cargar({ fondo: true, intento: intento + 1 }), 1200 + intento * 800);
        return;
      }

      // Actualizamos SOLO con datos válidos. Si algo vino vacío, conservamos lo
      // que ya había (no piso la info buena con un fallo puntual).
      if (metrics && (metrics.trained || !info)) setInfo(metrics);
      if (lista.length || !modelos.length) setModelos(lista);
      if (act || !activo) setActivo(act);
      if (resStats?.data) setStats(resStats.data);

      // ÉXITO: si conseguimos el estado del modelo, limpiamos cualquier error viejo.
      if (metrics && metrics.trained) {
        setError("");
      } else if (!fondo && !resMetrics) {
        // Solo mostramos error en la carga inicial (no en refrescos de fondo),
        // y solo si de verdad no pudimos leer nada.
        setError("No se pudo consultar el estado del modelo. Reintentando...");
      }
    } catch {
      if (!fondo) setError("No se pudo consultar el estado del modelo. Reintentando...");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // Auto-refresco en segundo plano (fondo=true): no muestra errores ni spinner,
    // solo actualiza los datos si cambian.
    const id = setInterval(() => cargar({ fondo: true }), 15000);
    return () => clearInterval(id);
  }, []);

  const onSubir = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(""); setMensaje(""); setSubiendo(true);
    try {
      await mlService.subirModelo(file);
      setMensaje(`Modelo "${file.name}" subido correctamente.`);
      cargar();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo subir el modelo. Verificá que sea un .pkl válido.");
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onActivar = async (archivo) => {
    setError(""); setMensaje("");
    try {
      await mlService.activarModelo(archivo);
      setMensaje("Modelo activado. El motor lo usará en unos segundos.");
      cargar();
    } catch {
      setError("No se pudo activar ese modelo.");
    }
  };

  const onEliminar = async (archivo) => {
    if (!window.confirm(`¿Eliminar el modelo "${archivo}"?`)) return;
    setError(""); setMensaje("");
    try {
      await mlService.eliminarModelo(archivo);
      cargar();
    } catch {
      setError("No se pudo eliminar ese modelo.");
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: t.text3, fontSize: 13 }}>Consultando estado del modelo...</div>;
  }

  const trained = info?.trained;
  const d = stats?.dos_etapas || {};
  const totalDosEtapas = (d.confirmadas_ml || 0) + (d.solo_firma || 0) + (d.sin_ml || 0);
  const pct = (n) => totalDosEtapas > 0 ? Math.round((n / totalDosEtapas) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Métricas rápidas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <MetricCard label="Modelo activo" value={info?.model ?? "—"} color={t.accent} t={t} />
        <MetricCard label="Estado" value={trained ? "Activo" : "Sin modelo"} color={trained ? t.ok : t.text2} t={t} />
        <MetricCard label="Clases" value={String(info?.n_clases ?? 0)} color={t.accent} t={t} />
        <MetricCard label="Features" value={String(info?.n_features ?? 0)} color={t.accent} t={t} />
      </div>

      {error   && <div style={{ fontSize: 12, color: t.danger }}>{error}</div>}
      {mensaje && <div style={{ fontSize: 12, color: t.ok }}>{mensaje}</div>}

      {/* ── FICHA TÉCNICA DEL MODELO (todos los roles) ───────────────────── */}
      <div style={s.card}>
        <SectionHeader title="Ficha técnica del modelo" t={t} />
        {trained ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: t.text2 }}>
            <FilaFicha t={t} k="Nombre" v={info.model} />
            <FilaFicha t={t} k="Archivo" v={info.archivo} mono />
            <FilaFicha t={t} k="Subido" v={info.subido?.replace("T", " ") ?? "—"} />
            <FilaFicha t={t} k="Clases que detecta" v={(info.clases || []).join(", ") || "—"} />
            <FilaFicha t={t} k="Nº de features" v={`${info.n_features} características de flujo`} />
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 12, color: t.text3 }}>Features usadas:</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {(info.columnas || []).map((c) => (
                  <span key={c} style={{
                    fontSize: 10.5, color: t.text3, background: t.bg2,
                    padding: "2px 6px", borderRadius: 4, fontFamily: "monospace",
                  }}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: t.text3 }}>No hay modelo activo.</div>
        )}
      </div>

      {/* ── RESUMEN DE LAS DOS ETAPAS (todos los roles) ──────────────────── */}
      <div style={s.card}>
        <SectionHeader title="Cómo está funcionando: las dos etapas" t={t} />
        <p style={{ fontSize: 12.5, color: t.text3, marginTop: 0, lineHeight: 1.5 }}>
          Cada alerta pasa por dos etapas: la firma la detecta por patrón, y el
          modelo ML la verifica. Este resumen muestra el aporte de cada una sobre
          las {stats?.total ?? 0} alertas registradas.
        </p>
        {totalDosEtapas > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BarraEtapa t={t} label="✓ Confirmadas por el ML"
              detalle="Las dos etapas coinciden: el ML confirma el ataque"
              valor={d.confirmadas_ml || 0} pct={pct(d.confirmadas_ml || 0)} color="#16a34a" />
            <BarraEtapa t={t} label="⚠ Detectadas solo por firma"
              detalle="El ML no concluyó (ej. fuerza bruta); la firma la conservó"
              valor={d.solo_firma || 0} pct={pct(d.solo_firma || 0)} color="#d97706" />
            <BarraEtapa t={t} label="— Sin verificación ML"
              detalle="No hubo flujo para verificar o no había modelo"
              valor={d.sin_ml || 0} pct={pct(d.sin_ml || 0)} color={t.text3} />
          </div>
        ) : (
          <div style={{ fontSize: 13, color: t.text3, textAlign: "center", padding: "16px 0" }}>
            Aún no hay alertas para mostrar estadísticas.
          </div>
        )}
      </div>

      {/* ── ALERTAS POR CLASE (todos los roles) ──────────────────────────── */}
      {stats?.por_clase && Object.keys(stats.por_clase).length > 0 && (
        <div style={s.card}>
          <SectionHeader title="Ataques detectados por clase (según el ML)" t={t} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {Object.entries(stats.por_clase)
              .sort((a, b) => b[1] - a[1])
              .map(([clase, n]) => {
                const max = Math.max(...Object.values(stats.por_clase));
                const w = max > 0 ? Math.round((n / max) * 100) : 0;
                const esBenign = clase === "BENIGN";
                return (
                  <div key={clase} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: t.text2, width: 90, fontWeight: 600 }}>{clase}</span>
                    <div style={{ flex: 1, height: 18, background: t.bg2, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${w}%`, height: "100%", background: esBenign ? t.text3 : t.accent, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 12, color: t.text, width: 44, textAlign: "right", fontFamily: "monospace" }}>{n}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── GESTIÓN DE MODELOS (SOLO DESARROLLADOR) ──────────────────────── */}
      {esDesarrollador ? (
        <>
          <div style={s.card}>
            <SectionHeader title="Subir modelo (.pkl)" t={t} />
            <p style={{ fontSize: 12.5, color: t.text3, marginTop: 0, lineHeight: 1.5 }}>
              Subí un archivo de modelo entrenado (.pkl) generado desde el notebook.
              El sistema valida que tenga la estructura correcta antes de aceptarlo.
            </p>
            <input ref={fileRef} type="file" accept=".pkl,.joblib" onChange={onSubir}
              disabled={subiendo} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={subiendo}
              style={{ ...s.btn("primary"), opacity: subiendo ? 0.6 : 1, cursor: subiendo ? "default" : "pointer" }}>
              {subiendo ? "Subiendo..." : "Seleccionar archivo .pkl"}
            </button>
          </div>

          <div style={s.card}>
            <SectionHeader title="Modelos disponibles" t={t} />
            {modelos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: t.text3, fontSize: 13 }}>
                Aún no hay modelos. Subí un .pkl para empezar.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {modelos.map((m) => {
                  const esActivo = m.archivo === activo;
                  return (
                    <div key={m.archivo} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", borderRadius: 8,
                      border: `1px solid ${esActivo ? t.ok : t.border}`,
                      background: esActivo ? `${t.ok}11` : "transparent",
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                          {m.nombre_modelo} {esActivo && <span style={{ color: t.ok, fontSize: 11 }}>● ACTIVO</span>}
                        </span>
                        <span style={{ fontSize: 11, color: t.text3, fontFamily: "monospace" }}>
                          {m.archivo} · subido {m.subido?.replace("T", " ")}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {!esActivo && (
                          <button onClick={() => onActivar(m.archivo)}
                            style={{ ...s.btn("default"), fontSize: 12, padding: "5px 10px" }}>
                            Usar este
                          </button>
                        )}
                        <button onClick={() => onEliminar(m.archivo)}
                          style={{ ...s.btn("danger"), fontSize: 12, padding: "5px 10px" }}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        // admin / analyst: aviso de solo lectura, sin botones de gestión
        <div style={{ fontSize: 11.5, color: t.text3, lineHeight: 1.5, padding: "0 4px" }}>
          Estás viendo el modelo en modo consulta. La gestión de modelos (subir,
          activar o eliminar) está reservada al rol Desarrollador.
        </div>
      )}
    </div>
  );
}

// Fila de la ficha técnica
function FilaFicha({ t, k, v, mono }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <span style={{ fontSize: 12.5, color: t.text3, width: 150, flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 12.5, color: t.text, fontFamily: mono ? "monospace" : "inherit" }}>{v}</span>
    </div>
  );
}

// Barra de una etapa (con porcentaje)
function BarraEtapa({ t, label, detalle, valor, pct, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color }}>{label}</span>
        <span style={{ fontSize: 12, color: t.text2, fontFamily: "monospace" }}>{valor} ({pct}%)</span>
      </div>
      <div style={{ height: 8, background: t.bg2, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, color: t.text3 }}>{detalle}</span>
    </div>
  );
}