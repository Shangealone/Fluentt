import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/services/admin-server";
import { AdminNav } from "@/components/admin-nav";
import { VocabularyManager } from "@/components/vocabulary-manager";
async function Page() {
  const profile = await requireAdmin();
  return <div className="shell"><header><Link href="/" className="brand">FLUENTT <span>●</span></Link><span className="badge">Administration</span></header>
    <main className="dashboard-content"><AdminNav profile={profile} current="vocabulary" /><h1>Vocabulary reviews</h1>
      {profile.permissions.includes("curriculum.read") ? <VocabularyManager initial={profile} /> : <p role="alert">Curriculum access is required to manage vocabulary.</p>}
    </main></div>;
}
export default function VocabularyPage() { return <Suspense fallback={<p role="status">Verifying access…</p>}><Page /></Suspense>; }
