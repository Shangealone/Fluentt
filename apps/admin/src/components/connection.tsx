"use client";
import { useState } from "react";
import { checkHealth } from "@/services/api";
import { Button } from "./ui";
export function Connection() {
  const [state, setState] = useState("Not checked");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setLoading(true);
    setError("");
    try {
      await checkHealth();
      setState("API connected");
    } catch (e) {
      setState("API unavailable");
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="connection" aria-label="Backend connection">
      <div>
        <strong>Service connection</strong>
        <p role="status">{loading ? "Checking connection…" : state}</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <Button disabled={loading} onClick={check}>
        {loading ? "Checking…" : "Check connection"}
      </Button>
    </section>
  );
}
