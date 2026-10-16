import Link from "next/link";
import { Connection } from "@/components/connection";
import { Card } from "@/components/ui";
export default function Home() {
  return (
    <div className="shell">
      <header>
        <Link className="brand" href="/" aria-label="FLUENTT home">
          FLUENTT <span>●</span>
        </Link>
        <span className="badge">ADMINISTRATION</span>
      </header>
      <main>
        <div className="hero">
          <p className="eyebrow">THOUGHTFUL TOOLS. MEANINGFUL LEARNING.</p>
          <h1>
            A strong foundation
            <br />
            for every learner.
          </h1>
          <p className="intro">
            The future home for managing FLUENTT learning content, classrooms
            and research.
          </p>
          <div className="notice">
            <span aria-hidden="true">○</span>
            <div>
              <strong>Administration is being prepared</strong>
              <p>
                This is a development landing page. Secure administrator sign-in
                is planned for Section 08.
              </p>
            </div>
          </div>
        </div>
        <div className="grid">
          <Card>
            <span className="number">01 / CONTENT</span>
            <h2>Learning with purpose</h2>
            <p>
              Versioned curriculum and reusable activities for English and
              Tagalog.
            </p>
          </Card>
          <Card>
            <span className="number">02 / CLASSROOMS</span>
            <h2>Room to grow</h2>
            <p>
              A future space to support instructors and their learning
              communities.
            </p>
          </Card>
          <Card>
            <span className="number">03 / RESEARCH</span>
            <h2>Evidence-led progress</h2>
            <p>
              Planned tools for approved studies, controlled activities and
              coded analysis.
            </p>
          </Card>
        </div>
        <Connection />
      </main>
      <footer>
        <span>FLUENTT · NE Learning Inc.</span>
        <span>Development foundation / Section 01</span>
      </footer>
    </div>
  );
}
