import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/services/admin-server";
import { AdminNav } from "@/components/admin-nav";
import { QuestionManager } from "@/components/question-manager";

async function Questions() {
  const profile = await requireAdmin();
  return <div className="shell"><header><Link href="/" className="brand">FLUENTT <span>●</span></Link><span className="badge">ADMINISTRATION</span></header>
    <main className="dashboard-content"><AdminNav profile={profile} current="questions" /><h1>Question Bank</h1>
      {profile.permissions.includes("questions.read") ? <QuestionManager initial={profile} />
        : <section role="alert"><h2>Question Bank access required</h2><p>An operator must explicitly grant question access to this account.</p></section>}
    </main></div>;
}
export default function QuestionPage() {
  return <Suspense fallback={<main className="shell" role="status">Verifying question access…</main>}><Questions /></Suspense>;
}
