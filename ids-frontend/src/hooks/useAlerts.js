import { useState, useEffect, useCallback } from "react";
import { alertsService } from "../services/api";

// Hook de alertas conectado al backend real (MySQL). Sin simulaciones.
// Mientras el motor del IDS no genere alertas, la lista llega vacía.
export function useAlerts() {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const cargar = useCallback(async () => {
    try {
      const res = await alertsService.getAll();
      // normaliza severidad del backend (low/medium/high/critical) a la UI
      setAlerts(res.data || []);
      setError("");
    } catch {
      setError("No se pudieron cargar las alertas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    // refresco periódico cada 10s para traer alertas nuevas que genere el IDS
    const iv = setInterval(cargar, 10000);
    return () => clearInterval(iv);
  }, [cargar]);

  const acknowledge = useCallback(async (id) => {
    try {
      await alertsService.acknowledge(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    } catch { /* noop */ }
  }, []);

  const acknowledgeAll = useCallback(async () => {
    try {
      await alertsService.ackAll();
      setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    } catch { /* noop */ }
  }, []);

  const activeCount = alerts.filter((a) => !a.acknowledged).length;
  const critCount   = alerts.filter((a) => a.severity === "critical" && !a.acknowledged).length;

  return { alerts, loading, error, acknowledge, acknowledgeAll, activeCount, critCount, refetch: cargar };
}
