import { useState, useEffect, useRef } from "react";
import { useStyles } from "../hooks/useStyles";
import { MetricCard, SectionHeader } from "../components/ui/SharedUI";
import { mlService } from "../services/api";

export function PageML({ t }) {
  const s = useStyles(t);
  const [info, setInfo]         = useState(null);
  const [modelos, setModelos]   = useState([]);
  const [activo, setActivo]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [mensaje, setMensaje]   = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef(null);

  const cargar = () => {
    mlService.getMetrics()
      .then((res) => setInfo(res.data))
      .catch(() => setError("No se pudo consultar el estado del modelo."));
    mlService.listarModelos()
      .then((res) => {
        setModelos(res.data.modelos || []);
        setActivo(res.data.activo || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

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
      setMensaje(`Modelo activado. El motor lo usará en unos segundos.`);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <MetricCard label="Modelo activo" value={info?.model ?? "—"} color={t.accent} t={t} />
        <MetricCard label="Estado" value={trained ? "Activo" : "Sin modelo"} color={trained ? t.ok : t.text2} t={t} />
        <MetricCard label="Modelos subidos" value={String(modelos.length)} color={t.accent} t={t} />
      </div>

      {error   && <div style={{ fontSize: 12, color: t.danger }}>{error}</div>}
      {mensaje && <div style={{ fontSize: 12, color: t.ok }}>{mensaje}</div>}

      {/* Subir modelo */}
      <div style={s.card}>
        <SectionHeader title="Subir modelo (.pkl)" t={t} />
        <p style={{ fontSize: 12.5, color: t.text3, marginTop: 0, lineHeight: 1.5 }}>
          Subí un archivo de modelo entrenado (.pkl) generado desde el notebook.
          El sistema valida que tenga la estructura correcta antes de aceptarlo.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pkl,.joblib"
          onChange={onSubir}
          disabled={subiendo}
          style={{ display: "none" }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={subiendo}
          style={{
            ...s.btn("primary"),
            opacity: subiendo ? 0.6 : 1,
            cursor: subiendo ? "default" : "pointer",
          }}
        >
          {subiendo ? "Subiendo..." : "Seleccionar archivo .pkl"}
        </button>
      </div>

      {/* Lista de modelos */}
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

      {/* Nota informativa */}
      <div style={{ fontSize: 11.5, color: t.text3, lineHeight: 1.5, padding: "0 4px" }}>
        El modelo activo se usa como segunda etapa de verificación: cuando una firma
        detecta tráfico sospechoso, el modelo confirma si es un ataque real o descarta
        la alerta como falso positivo.
      </div>
    </div>
  );
}
