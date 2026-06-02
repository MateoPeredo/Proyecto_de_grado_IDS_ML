import { useState, useEffect, useCallback } from "react";
import { INITIAL_ALERTS, randAlert } from "../utils/mockData";

export function useAlerts() {
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);

  // Simulate incoming alerts every 4 seconds
  useEffect(() => {
    const iv = setInterval(() => {
      setAlerts((prev) => [randAlert(), ...prev].slice(0, 60));
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  const acknowledge = useCallback((id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  }, []);

  const acknowledgeAll = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
  }, []);

  const activeCount = alerts.filter((a) => !a.acknowledged).length;
  const critCount   = alerts.filter((a) => a.sev === "crit" && !a.acknowledged).length;

  return { alerts, acknowledge, acknowledgeAll, activeCount, critCount };
}
