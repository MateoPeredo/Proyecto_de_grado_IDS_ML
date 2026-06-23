import { useState, useEffect } from "react";
import { useStyles } from "../hooks/useStyles";
import { SectionHeader } from "../components/ui/SharedUI";
import { NavIcon } from "../components/ui/NavIcon";
import { authService } from "../services/api";
import { useAuthStore } from "../store/authStore";

export function PageUsuarios({ t }) {
  const s = useStyles(t);
  const usuarioActual = useAuthStore((st) => st.user);

  const [usuarios, setUsuarios] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [msg,      setMsg]      = useState("");

  // alta
  const [form, setForm] = useState({ username: "", password: "", role: "analyst" });
  const [creando, setCreando] = useState(false);

  // edición inline
  const [editId, setEditId]   = useState(null);
  const [editRole, setEditRole] = useState("analyst");
  const [editPass, setEditPass] = useState("");

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const res = await authService.listUsers();
      setUsuarios(res.data);
      setError("");
    } catch {
      setError("No se pudieron cargar los usuarios. ¿Está el backend disponible?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarUsuarios(); }, []);

  const crearUsuario = async (e) => {
    e.preventDefault();
    setMsg(""); setError(""); setCreando(true);
    try {
      await authService.register(form);
      setMsg(`Usuario "${form.username}" creado correctamente.`);
      setForm({ username: "", password: "", role: "analyst" });
      cargarUsuarios();
    } catch (err) {
      if (err.response?.status === 409) setError("Ese nombre de usuario ya existe.");
      else if (err.response?.status === 400) setError(err.response.data.detail || "Datos inválidos.");
      else setError("No se pudo crear el usuario.");
    } finally {
      setCreando(false);
    }
  };

  const empezarEdicion = (u) => {
    setEditId(u.id);
    setEditRole(u.role);
    setEditPass("");
    setMsg(""); setError("");
  };

  const guardarEdicion = async (id) => {
    setMsg(""); setError("");
    try {
      const data = { role: editRole };
      if (editPass.trim()) data.password = editPass.trim();
      await authService.updateUser(id, data);
      setMsg("Usuario actualizado.");
      setEditId(null);
      cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo actualizar el usuario.");
    }
  };

  const borrarUsuario = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario "${u.username}"?`)) return;
    setMsg(""); setError("");
    try {
      await authService.deleteUser(u.id);
      setMsg(`Usuario "${u.username}" eliminado.`);
      cargarUsuarios();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo eliminar el usuario.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Alta */}
      <div style={s.card}>
        <SectionHeader title="Crear nuevo usuario" t={t} />
        <form onSubmit={crearUsuario} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, alignItems: "end" }}>
          <div>
            <label style={s.label}>Usuario</label>
            <input style={s.input} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div>
            <label style={s.label}>Contraseña</label>
            <input style={s.input} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div>
            <label style={s.label}>Rol</label>
            <select style={s.input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="analyst">Analista</option>
              <option value="admin">Administrador</option>
              <option value="developer">Desarrollador</option>
            </select>
          </div>
          <button type="submit" disabled={creando} style={{ ...s.btn("primary"), justifyContent: "center", padding: "10px", opacity: creando ? 0.7 : 1 }}>
            <NavIcon name="plus" size={14} />
            {creando ? "Creando..." : "Crear usuario"}
          </button>
        </form>
        {msg   && <div style={{ marginTop: 12, fontSize: 12, color: t.accentTxt, background: t.accentBg, padding: "9px 12px", borderRadius: 8 }}>{msg}</div>}
        {error && <div style={{ marginTop: 12, fontSize: 12, color: t.danger, background: t.dangerBg, border: `0.5px solid ${t.danger}`, padding: "9px 12px", borderRadius: 8 }}>{error}</div>}
      </div>

      {/* Listado */}
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
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} style={{ borderTop: `0.5px solid ${t.border}` }}>
                  <td style={{ padding: "9px 6px", color: t.text3, fontFamily: "monospace" }}>{u.id}</td>
                  <td style={{ padding: "9px 6px", color: t.text, fontWeight: 500 }}>
                    {u.username}
                    {u.username === usuarioActual && <span style={{ fontSize: 10, color: t.text3, marginLeft: 6 }}>(tú)</span>}
                  </td>
                  <td style={{ padding: "9px 6px" }}>
                    {editId === u.id ? (
                      <select style={{ ...s.input, padding: "4px 8px", fontSize: 12 }} value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                        <option value="analyst">Analista</option>
                        <option value="admin">Administrador</option>
                        <option value="developer">Desarrollador</option>
                      </select>
                    ) : (
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: (u.role === "admin" || u.role === "developer") ? t.accentBg : t.bg3, color: (u.role === "admin" || u.role === "developer") ? t.accentTxt : t.text2 }}>
                        {u.role === "developer" ? "Desarrollador" : u.role === "admin" ? "Administrador" : "Analista"}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "9px 6px", textAlign: "right" }}>
                    {editId === u.id ? (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                        <input style={{ ...s.input, padding: "4px 8px", fontSize: 12, maxWidth: 140 }} type="password" placeholder="Nueva contraseña (opcional)" value={editPass} onChange={(e) => setEditPass(e.target.value)} />
                        <button onClick={() => guardarEdicion(u.id)} style={{ ...s.btn("primary"), fontSize: 11, padding: "4px 10px" }}>
                          <NavIcon name="check" size={12} /> Guardar
                        </button>
                        <button onClick={() => setEditId(null)} style={{ ...s.btn("ghost"), fontSize: 11, padding: "4px 8px" }}>
                          <NavIcon name="x" size={12} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => empezarEdicion(u)} style={{ ...s.btn("ghost"), fontSize: 11, padding: "4px 10px" }}>
                          Editar
                        </button>
                        <button onClick={() => borrarUsuario(u)} style={{ ...s.btn("ghost"), fontSize: 11, padding: "4px 8px", color: t.danger }}>
                          <NavIcon name="x" size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: t.text3 }}>Sin usuarios</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
