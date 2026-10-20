import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/services/admin-server";
import { AdminNav } from "@/components/admin-nav";
import { ResearchDashboard } from "@/components/research-dashboard";

async function Research() {
  const profile = await requireAdmin();
  return (
    <div className="shell">
      <header>
        <Link href="/" className="brand">
          FLUENTT <span>●</span>
        </Link>
        <span className="badge">ADMINISTRATION</span>
      </header>
      <main className="dashboard-content">
        <AdminNav profile={profile} current="research" />
        <div style={{ marginBottom: "24px" }}>
          <p className="eyebrow" style={{ margin: "0 0 6px" }}>Empirical Thesis Reporting</p>
          <h1 style={{ margin: 0 }}>Research Analytics &amp; Exports</h1>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
            Inspect protocol progress, descriptive group outcomes, paired gains, and export de-identified experimental datasets.
          </p>
        </div>
        {profile.permissions.includes("research.read") ? (
          <ResearchDashboard initialProfile={profile} />
        ) : (
          <section role="alert">
            <h2>Research access required</h2>
            <p>An operator must explicitly grant research read permissions to this administrator account.</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<main className="shell" role="status">Verifying research access…</main>}>
      <Research />
    </Suspense>
  );
}
