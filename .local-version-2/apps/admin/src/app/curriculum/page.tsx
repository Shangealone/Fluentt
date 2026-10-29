import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/services/admin-server";
import { AdminNav } from "@/components/admin-nav";
import { CurriculumManager } from "@/components/curriculum-manager";

async function Curriculum() {
  const profile = await requireAdmin();
  return <div className="shell"><header><Link href="/" className="brand">FLUENTT <span>●</span></Link>
    <span className="badge">ADMINISTRATION</span></header><main className="dashboard-content">
    <AdminNav profile={profile} current="curriculum" /><h1>Curriculum</h1>
    {profile.permissions.includes("curriculum.read") ? <CurriculumManager initial={profile} />
      : <section role="alert"><h2>Curriculum access required</h2><p>An operator must explicitly grant curriculum access to this account.</p></section>}
  </main></div>;
}
export default function CurriculumPage() {
  return <Suspense fallback={<main className="shell" role="status">Verifying curriculum access…</main>}><Curriculum /></Suspense>;
}
