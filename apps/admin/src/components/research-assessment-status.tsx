import { Button } from "./ui";
import type { AssessmentPublication } from "@/services/research-classroom-contract";
import styles from "./research-setup.module.css";

export function ResearchAssessmentStatus({ publication }: { publication?: AssessmentPublication }) {
  return <section className={styles.requirements} aria-label="Research assessment publication">
    <h3>Assessment publication: BLOCKED</h3>
    <p>Pre-test, immediate post-test and delayed retention are draft plans. Approved instruments, timing rules and participant authorization are still required. No attempts or countdowns are available.</p>
    {publication && <ul>{publication.blockers.map(item => <li key={item}>{item.replaceAll("_", " ").replaceAll(":", ": ")}</li>)}</ul>}
    <Button type="button" disabled>Publish assessments (unavailable)</Button>
  </section>;
}
