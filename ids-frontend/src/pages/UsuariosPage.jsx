import { useState, useEffect } from "react";
import { useStyles } from "../hooks/useStyles";
import { SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { authService } from "../services/api";

export function PageUsuarios({ t }) {
  const s = useStyles(t);
  const [usuarios, setUsuarios] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // formulario de alta
  const [form, setForm] = useState({ username: "", password: "", role: "analyst" });
  const [creando, setCreando] = useState(false);
  const [msg,     setMsg]     = useState("");

  const cargarUsuarios = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authService.listUsers();
      setUsuarios(res.data);
    } catch (err) {
      setError("No se pudieron cargar los usuarios. ¿Está el backend disponible?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarUsuarios(); }, []);

  const crearUsuario = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    setCreando(true);
    try {
      await authService.register(form);
      setMsg(`Usuario "${form.username}" creado correctamente.`);
      setForm({ username: "", password: "", role: "analyst" });
      cargarUsuarios();
    } catch (err) {
      if (err.response?.status === 409) {
        setError("Ese nombre de usuario ya existe.");
      } else if (err.response?.status === 400) {
        setError(err.response.data.detail || "Datos inválidos.");
      } else {
        setError("No se pudo crear el usuario.");
      }
    } finally {
      setCreando(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Formulario de alta */}
      <div style={s.card}>
        <SectionHeader title="Crear nuevo usuario" t={t} />
        <form onSubmit={crearUsuario} style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 12,
          alignItems: "end",
        }}>
          <div>
            <label style={s.label}>Usuario</label>
            <input
              style={s.input}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div>
            <label style={s.label}>Contraseña</label>
            <input
              style={s.input}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <div>
            <label style={s.label}>Rol</label>
            <select
              style={s.input}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="analyst">Analista</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creando}
            style={{ ...s.btn("primary"), justifyContent: "center", padding: "10px", opacity: creando ? 0.7 : 1 }}
          >
            <NavIcon name="plus" size={14} />
            {creando ? "Creando..." : "Crear usuario"}
          </button>
        </form>

        {msg && (
          <div style={{ marginTop: 12, fontSize: 12, color: t.accentTxt, background: t.accentBg, padding: "9px 12px", borderRadius: 8 }}>
            {msg}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 12, fontSize: 12, color: t.danger, background: t.dangerBg, border: `0.5px solid ${t.danger}`, padding: "9px 12px", borderRadius: 8 }}>
            {error}
          </div>
        )}
      </div>

      {/* Listado de usuarios */}
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <SectionHeader title="Usuarios registrados" t={t} />
          <button onClick={cargarUsuarios} style={{ ...s.btn("ghost"), fontSize: 12 }}>
            <NavIcon name="refresh" size={13} /> Recargar
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: t.text3, fontSize: 13 }}>Cargando...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: t.text3, fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "8px 6px" }}>ID</th>
                <th style={{ padding: "8px 6px" }}>Usuario</th>
                <th style={{ padding: "8px 6px" }}>Rol</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={{ borderTop: `0.5px solid ${t.border}` }}>
                  <td style={{ padding: "9px 6px", color: t.text3, fontFamily: "monospace" }}>{u.id}</td>
                  <td style={{ padding: "9px 6px", color: t.text, fontWeight: 500 }}>{u.username}</td>
                  <td style={{ padding: "9px 6px" }}>
                    <span style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: u.role === "admin" ? t.accentBg : t.bg3,
                      color: u.role === "admin" ? t.accentTxt : t.text2,
                    }}>
                      {u.role === "admin" ? "Administrador" : "Analista"}
                    </span>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr><td colSpan={3} style={{ padding: 16, textAlign: "center", color: t.text3 }}>Sin usuarios</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
