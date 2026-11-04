import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MonitoringScreen, type Section, type Params } from "@/components/monitoring-screen";

const sections = new Set<Section>(["classes", "students", "learn", "fsrs", "fifakt", "pronunciation", "tutor", "users", "status"]);

export default async function MonitoringPage({ params, searchParams }: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Params>;
}) {
  const { section } = await params;
  if (!sections.has(section as Section)) notFound();
  return <Suspense fallback={<main className="shell" role="status">Loading administrator monitoring…</main>}>
    <MonitoringScreen section={section as Section} searchParams={searchParams} />
  </Suspense>;
}
