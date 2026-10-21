import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/services/admin-server";
import { AdminNav } from "@/components/admin-nav";
import { ResearchManager } from "@/components/research-manager";
import { cookies } from "next/headers";

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
          <p className="eyebrow" style={{ margin: "0 0 6px" }}>Research Administration</p>
          <h1 style={{ margin: 0 }}>Research Management</h1>
          <p style={{ margin: "6px 0 0", color: "var(--muted)" }}>
            Set up explicitly designated research classrooms, review requirements, and inspect retained study configurations.
          </p>
        </div>
        {profile.permissions.includes("research.read") ? (
          <ResearchManager initial={profile} previewOnly={(await cookies()).get("fluentt_demo_admin")?.value === "1"} />
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
