import Link from "next/link";
import { Connection } from "@/components/connection";

export default function Home() {
  return <div className="shell">
    <header><Link className="brand" href="/" aria-label="FLUENTT home">FLUENTT <span>●</span></Link><span className="badge">Administration</span></header>
    <main>
      <section className="welcome-grid">
        <div className="welcome-copy">
          <p className="eyebrow">A little structure. More room to teach.</p>
          <h1>Good learning<br />starts here.</h1>
          <p className="intro">A focused workspace for the content behind your classrooms. Organize curriculum, prepare questions, and review before publishing.</p>
          <div className="welcome-art" aria-hidden="true"><span>Aa</span><div><strong>Ideas become lessons.</strong><p>English · Filipino · Curriculum</p></div></div>
        </div>
        <section className="signin-card" aria-labelledby="access-title">
          <span className="eyebrow">Your workspace</span>
          <h2 id="access-title">Welcome to Fluentt</h2>
          <p>Sign in with your organization’s account to access your administration tools.</p>
          <Link className="button" href="/login">Administrator sign-in <span aria-hidden="true">→</span></Link>
          <div className="demo-access"><strong>Just exploring?</strong><p>Preview the workspace with sample content.</p><form method="post" action="/api/admin/demo-login"><button type="submit" className="button secondary-button">Open sample workspace</button></form></div>
          <p className="small-note">Available tools depend on your account permissions.</p>
        </section>
      </section>
      <section className="feature-strip" aria-label="Workspace tools">
        <div><span className="number">01</span><h2>Organize curriculum</h2><p>Keep editions, subjects, and lessons in a clear hierarchy.</p></div>
        <div><span className="number">02</span><h2>Prepare questions</h2><p>Build activities using ten supported question formats.</p></div>
        <div><span className="number">03</span><h2>Review and publish</h2><p>Check your content before making an edition available.</p></div>
      </section>
      <details className="connection-details"><summary>Service connection</summary><Connection /></details>
    </main>
    <footer><span>FLUENTT · NE Learning Inc.</span><span>Administration workspace</span></footer>
  </div>;
}
