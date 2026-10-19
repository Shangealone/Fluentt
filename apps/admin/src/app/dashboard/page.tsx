import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/services/admin-server";
import { AdminSession } from "@/components/admin-session";
import { AdminNav } from "@/components/admin-nav";

async function Dashboard() {
  const profile = await requireAdmin();
  return <div className="shell">
    <header><Link href="/" className="brand">FLUENTT <span>●</span></Link><span className="badge">Administration</span></header>
    <main className="dashboard-content">
      <AdminNav profile={profile} current="dashboard" />
      <section className="workspace-heading"><p className="eyebrow">Your workspace</p><h1>Welcome, {profile.username}</h1><p>Start with your curriculum, or get straight to preparing questions.</p></section>
      <div className="workspace-grid">
        <section className="card workspace-card"><span className="tool-icon" aria-hidden="true">01</span><h2>Curriculum</h2><p>Organize editions, grades, subjects, and lessons. Review the structure before publishing.</p>{profile.permissions.includes("curriculum.read") ? <Link className="button" href="/curriculum">Open curriculum <span aria-hidden="true">→</span></Link> : <p className="small-note">Ask your operator for curriculum access.</p>}</section>
        <section className="card workspace-card"><span className="tool-icon amber" aria-hidden="true">02</span><h2>Question bank</h2><p>Create and preview questions across ten assessment formats. Keep published versions together with their history.</p>{profile.permissions.includes("questions.read") ? <Link className="button" href="/questions">Open question bank <span aria-hidden="true">→</span></Link> : <p className="small-note">Ask your operator for question bank access.</p>}</section>
      </div>
      <details className="session-details"><summary>Account and session</summary><AdminSession initial={profile} /></details>
    </main>
  </div>;
}
export default function DashboardPage() {
  return <Suspense fallback={<main className="shell" role="status">Verifying administrator session…</main>}><Dashboard /></Suspense>;
}
