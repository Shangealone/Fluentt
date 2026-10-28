import Link from "next/link";
import type { AdminProfile } from "@/services/admin-contract";
import { AdminIcon, type IconName } from "./admin-icon";
import { moduleInfo, sections, type Section } from "@/services/oversight-contract";
export type AdminSection = "dashboard" | "curriculum" | "questions" | "research" | Section;
const icons: Record<Section, IconName> = {users:"users",classes:"book",algorithms:"algorithm",analytics:"chart","pronunciation-analytics":"mic",reports:"file",audit:"shield",settings:"settings"};

export function AdminNav({ profile, current, previewOnly = false }: { profile: AdminProfile; current: AdminSection; previewOnly?: boolean }) {
  return <nav aria-label="Administrator navigation" className="admin-nav">
    <Link href="/dashboard" aria-current={current === "dashboard" ? "page" : undefined}><AdminIcon name="home" size={18} /> Overview</Link>
    {sections.filter(section=>previewOnly || profile.permissions.includes(moduleInfo[section].permission)).map(section=><Link key={section} href={`/${section}`} aria-current={current===section?"page":undefined}><AdminIcon name={icons[section]} size={18}/>{moduleInfo[section].title}</Link>)}
    {profile.permissions.includes("curriculum.read") &&
      <Link href="/curriculum" aria-current={current === "curriculum" ? "page" : undefined}><AdminIcon name="book" size={18} /> Curriculum</Link>}
    {profile.permissions.includes("questions.read") &&
      <Link href="/questions" aria-current={current === "questions" ? "page" : undefined}><AdminIcon name="chat" size={18} /> Question bank</Link>}
    {profile.permissions.includes("research.read") &&
      <Link href="/research" aria-current={current === "research" ? "page" : undefined}><AdminIcon name="research" size={18} /> Research</Link>}
  </nav>;
}
