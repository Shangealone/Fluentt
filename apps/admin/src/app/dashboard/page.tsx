import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { requireAdmin } from "@/services/admin-server";
import { DEMO_ADMIN_COOKIE } from "@/services/admin-demo";
import { AdminSession } from "@/components/admin-session";
import { AdminNav } from "@/components/admin-nav";
import { AdminIcon, type IconName } from "@/components/admin-icon";
import { PerformanceMonitor } from "@/components/performance-monitor";
import { OversightPanel } from "@/components/oversight-panel";
import styles from "@/components/performance.module.css";

async function Dashboard() {
  const profile = await requireAdmin();
  const preview = (await cookies()).get(DEMO_ADMIN_COOKIE)?.value === "1";
  const tools: { title: string; description: string; icon: IconName; href: string; permission: string }[] = [
    { title: "Curriculum", description: "Organize lessons and topics. Review editions before publishing.", icon: "book", href: "/curriculum", permission: "curriculum.read" },
    { title: "Question bank", description: "Prepare questions and keep published versions with their history.", icon: "chat", href: "/questions", permission: "questions.read" },
    { title: "Research", description: "Manage authorized studies and inspect consent-gated research records.", icon: "research", href: "/research", permission: "research.read" },
  ];
  return <div className={styles.workspace}>
    <header className={styles.header}>
      <Link href="/dashboard" className={styles.brand}><span className={styles.brandMark}>F.</span>FLUENTT<small>ADMINISTRATION</small></Link>
      <div className={styles.account}><span>Administrator</span><span className={styles.avatar} aria-hidden="true">{profile.username.slice(0, 1).toUpperCase()}</span><a href="#account">{profile.username}</a></div>
    </header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}><AdminNav profile={profile} current="dashboard" previewOnly={preview} /><div className={styles.sidebarNote}><AdminIcon name="shield" /><p>A focused workspace for learning activity, content, and approved research.</p></div></aside>
      <main>
        <section className={styles.hero}><div><p className={styles.eyebrow}>Learning overview</p><h1>Understand the activity.<br />Support the learner.</h1><p>Welcome, {profile.username}. See participation across Learn, Voice, and Tutor, then take a closer look at each learner.</p></div><div className={styles.heroArt} aria-hidden="true"><AdminIcon name="users" size={48} /></div></section>
        <h2>School overview</h2>
        <OversightPanel view="summary" permitted={profile.permissions.includes("oversight.read")} preview={preview} />
        <h2>Personal activity · separate participation records</h2>
        <PerformanceMonitor permitted={profile.permissions.includes("performance.read")} preview={preview} />
        <p className={styles.eyebrow}>Workspace tools</p>
        <div className={styles.tools}>{tools.filter(tool => profile.permissions.includes(tool.permission)).map(tool => <section className={styles.tool} key={tool.href}><AdminIcon name={tool.icon} /><h3>{tool.title}</h3><p>{tool.description}</p><Link href={tool.href}>Open {tool.title.toLowerCase()} <AdminIcon name="arrow" size={14} /></Link></section>)}</div>
        <details className={styles.session} id="account"><summary>Account and session</summary><AdminSession initial={profile} /></details>
      </main>
    </div>
  </div>;
}
export default function DashboardPage() {
  return <Suspense fallback={<main className="shell" role="status">Verifying administrator session…</main>}><Dashboard /></Suspense>;
}
