import Link from "next/link";
import type { AdminProfile } from "@/services/admin-contract";

export function AdminNav({ profile, current }: { profile: AdminProfile; current: "dashboard" | "curriculum" | "questions" | "research" }) {
  return <nav aria-label="Administrator navigation" className="admin-nav">
    <Link href="/dashboard" aria-current={current === "dashboard" ? "page" : undefined}><span aria-hidden="true">⌂ </span>Dashboard</Link>
    {profile.permissions.includes("curriculum.read") &&
      <Link href="/curriculum" aria-current={current === "curriculum" ? "page" : undefined}><span aria-hidden="true">▤ </span>Curriculum</Link>}
    {profile.permissions.includes("questions.read") &&
      <Link href="/questions" aria-current={current === "questions" ? "page" : undefined}><span aria-hidden="true">✎ </span>Question Bank</Link>}
    {profile.permissions.includes("research.read") &&
      <Link href="/research" aria-current={current === "research" ? "page" : undefined}><span aria-hidden="true">🔬 </span>Research Management</Link>}
  </nav>;
}
