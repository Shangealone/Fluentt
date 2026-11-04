import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin-login";
import { Card } from "@/components/ui";
import { backend, localMonitoringPreview } from "@/services/admin-server";
import { isAdminProfile } from "@/services/admin-contract";

async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await localMonitoringPreview()) redirect("/dashboard");
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
      <p style={{ marginTop: "16px", fontSize: "13px" }}>No administrator self-registration is available.</p>
    </main>
  </div>;
}


export default function LoginPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<main className="shell" role="status">Checking administrator access…</main>}><Login {...props} /></Suspense>;
}
