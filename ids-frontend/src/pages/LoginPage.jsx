import { useState } from "react";
import { useStyles } from "../hooks/useStyles";
import { NavIcon } from "../components/ui/NavIcon";
import { authService } from "../services/api";

export function LoginPage({ t, mode, onToggleTheme, onLogin }) {
  const s = useStyles(t);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Llamada real al backend FastAPI
      const res = await authService.login(username, password);
      const { access_token, username: user, role } = res.data;
      // Entrega la sesión completa al componente padre (token + datos)
      onLogin({ username: user, role, token: access_token });
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Credenciales incorrectas.");
      } else if (err.code === "ERR_NETWORK") {
        setError("No se pudo conectar con el servidor. ¿Está el backend levantado?");
      } else {
        setError("Error al iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: t.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      position: "relative",
    }}>
      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        style={{ ...s.btn("ghost"), position: "absolute", top: 20, right: 20, fontSize: 12 }}
      >
        <NavIcon name={mode === "light" ? "moon" : "sun"} size={14} />
        {mode === "light" ? "Oscuro" : "Claro"}
      </button>

      <div style={{
        background: t.bg2,
        border: `0.5px solid ${t.border2}`,
        borderRadius: 16,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 400,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44,
            background: t.accent,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <NavIcon name="shield" size={22} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "-0.3px" }}>
              SigmaIDS
            </div>
            <div style={{ fontSize: 11, color: t.text3, fontFamily: "monospace" }}>
              ML-Enhanced · v2.4.1
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={s.label}>Usuario</label>
            <input
              style={s.input}
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
            />
          </div>

          <div>
            <label style={s.label}>Contraseña</label>
            <input
              style={s.input}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
            />
          </div>

          {error && (
            <div style={{
              fontSize: 12,
              color: t.danger,
              background: t.dangerBg,
              border: `0.5px solid ${t.danger}`,
              padding: "9px 12px",
              borderRadius: 8,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...s.btn("primary"),
              justifyContent: "center",
              padding: "12px",
              marginTop: 4,
              fontSize: 14,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Verificando..." : "Iniciar sesión"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 11, color: t.text3, marginTop: 18, fontFamily: "monospace" }}>
          demo: admin / admin123
        </div>
      </div>
    </div>
  );
}
