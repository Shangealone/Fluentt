import Link from "next/link";
import type { AdminProfile } from "@/services/admin-contract";
import { AdminNav, type AdminSection } from "./admin-nav";
import { AdminSession } from "./admin-session";
import styles from "./performance.module.css";

export function AdminWorkspace({ profile, current, title, description, children, previewOnly = false }: {
  profile: AdminProfile; current: AdminSection; title: string; description: string; children: React.ReactNode; previewOnly?: boolean;
}) {
  return <div className={styles.workspace}>
    <header className={styles.header}><Link href="/dashboard" className={styles.brand}><span className={styles.brandMark}>F.</span>FLUENTT<small>ADMINISTRATION</small></Link><div className={styles.account}><span>Administrator</span><a href="#account">{profile.username}</a></div></header>
    <div className={styles.layout}><aside className={styles.sidebar}><AdminNav profile={profile} current={current} previewOnly={previewOnly} /></aside>
      <main><div className={styles.cardHeading}><div><p className={styles.eyebrow}>Administrator workspace</p><h1 style={{fontSize:32,margin:"8px 0 16px"}}>{title}</h1><p>{description}</p></div></div>
        {children}<details className={styles.session} id="account"><summary>Account and session</summary><AdminSession initial={profile} /></details>
      </main>
    </div>
  </div>;
}
