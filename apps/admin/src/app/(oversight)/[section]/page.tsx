import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/services/admin-server";
import { DEMO_ADMIN_COOKIE } from "@/services/admin-demo";
import { sections, moduleInfo, type Section } from "@/services/oversight-contract";
import { AdminWorkspace } from "@/components/admin-workspace";
import { OversightPanel } from "@/components/oversight-panel";

async function Module({params}:{params:Promise<{section:string}>}) {
  const {section}=await params;
  if(!sections.includes(section as Section))notFound();
  const key=section as Section, info=moduleInfo[key], profile=await requireAdmin();
  const preview=(await cookies()).get(DEMO_ADMIN_COOKIE)?.value==="1";
  return <AdminWorkspace profile={profile} current={key} previewOnly={preview} title={info.title} description={info.description}>
    <OversightPanel view={info.view} permitted={profile.permissions.includes(info.permission)} preview={preview}
      canWrite={profile.permissions.includes("users.write")} csrf={profile.csrf_token} canExport={profile.permissions.includes("oversight.export")} report={key==="reports"} />
  </AdminWorkspace>;
}
export default function Page(props:{params:Promise<{section:string}>}) {
  return <Suspense fallback={<main className="shell" role="status">Verifying administrator access…</main>}><Module {...props}/></Suspense>;
}
