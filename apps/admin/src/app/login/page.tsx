import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin-login";
import { Card } from "@/components/ui";
import { backend } from "@/services/admin-server";
import { isAdminProfile } from "@/services/admin-contract";

async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  let enabled = false;
  let unavailable = false;
  let signedIn = false;
  try {
    const current = await backend("/me");
    signedIn = current.ok && isAdminProfile(await current.json());
    const config = await backend("/auth/config");
    enabled = config.ok && (await config.json()).enabled === true;
    unavailable = !config.ok || (current.status !== 401 && !current.ok);
  } catch { unavailable = true; }
  if (signedIn) redirect("/dashboard");
  return <div className="shell auth-shell">
    <header><Link className="brand" href="/">FLUENTT <span>●</span></Link><span className="badge">ADMINISTRATION</span></header>
    <main className="auth-content"><p className="eyebrow">AUTHORIZED ACCESS</p><h1>Administrator sign-in</h1>
      <Card>
        {params.error && <p className="error" role="alert">Sign-in could not be completed. Verify your account with your operator and try again.</p>}
        {params.expired && <p role="status">Your session ended. Sign in again to continue.</p>}
        {unavailable ? <><p role="alert">The account service is unavailable.</p><a className="button" href="/login">Retry</a></>
          : <AdminLogin enabled={enabled} />}
      </Card>
      <div className="demo-signin-card" style={{ marginTop: "24px", padding: "24px", background: "var(--accent)", border: "1.5px solid var(--primary)", borderRadius: "16px" }}>
        <p className="eyebrow" style={{ color: "var(--primary)", margin: "0 0 8px 0" }}>⚡ DEMONSTRATION ACCESS</p>
        <h2 style={{ margin: "0 0 10px 0", fontSize: "20px" }}>Instant Demo Sign-in</h2>
        <p style={{ margin: "0 0 16px 0", fontSize: "14px" }}>
          For testing and walkthroughs: bypass external OIDC setup and enter directly with full administrator permissions (Curriculum management, Question bank authoring & preview, and grading simulation).
        </p>
        <form method="post" action="/api/admin/demo-login">
          <button type="submit" className="button demo-button">⚡ Sign In as Demo Administrator (@admin_demo) →</button>
        </form>
      </div>
      <p style={{ marginTop: "16px", fontSize: "13px" }}>No administrator self-registration is available.</p>
    </main>
  </div>;
}


export default function LoginPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<main className="shell" role="status">Checking administrator access…</main>}><Login {...props} /></Suspense>;
}
