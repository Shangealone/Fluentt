import { Suspense } from "react";
import { MonitoringScreen } from "@/components/monitoring-screen";

export default function DashboardPage() {
  return <Suspense fallback={<main className="shell" role="status">Verifying administrator session…</main>}>
    <MonitoringScreen section="overview" />
  </Suspense>;
}
