import { useState } from "react";
import { checkHealth } from "../services/api/client";
export function useHealth() {
  const [status, setStatus] = useState("Not checked");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setLoading(true);
    setError("");
    try {
      await checkHealth();
      setStatus("Backend connected");
    } catch (e) {
      setStatus("Backend unavailable");
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }
  return { status, loading, error, check };
}
