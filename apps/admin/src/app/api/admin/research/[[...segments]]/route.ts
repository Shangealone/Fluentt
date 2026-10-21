import { proxyResearchSetup } from "@/services/research-proxy";
import { NextRequest } from "next/server";
import { backend, webOrigin, adminCookieNames } from "@/services/admin-server";
import {
  DEMO_RESEARCH_STUDIES,
  DEMO_RESEARCH_ANALYTICS,
  DEMO_PARTICIPANTS_CSV,
  DEMO_ASSESSMENTS_CSV,
  DEMO_REVIEWS_CSV,
} from "@/services/admin-demo";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ segments?: string[] }> }
) {
  const { segments = [] } = await context.params;
  if (segments[0] === "classrooms") return proxyResearchSetup(request, segments.slice(1), { backend, webOrigin, adminCookieNames });
  const headers = new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  const fail = (status: number, message: string) =>
    Response.json({ error: { message } }, { status, headers });

  const isDemo = request.cookies.get("fluentt_demo_admin")?.value === "1";

  // Route: /api/admin/research/studies
  if (segments.length === 1 && segments[0] === "studies") {
    if (isDemo) {
      return Response.json(DEMO_RESEARCH_STUDIES, { headers });
    }
    try {
      const res = await backend("/research/studies");
      if (!res.ok) {
        return fail(res.status, "Failed to retrieve research studies.");
      }
      const data = await res.json();
      return Response.json(data, { headers });
    } catch {
      return fail(500, "Research studies endpoint unavailable.");
    }
  }

  // Route: /api/admin/research/studies/[study_id]/analytics
  if (segments.length === 3 && segments[0] === "studies" && uuidRegex.test(segments[1]) && segments[2] === "analytics") {
    const studyId = segments[1];
    if (isDemo) {
      return Response.json({ ...DEMO_RESEARCH_ANALYTICS, study_id: studyId }, { headers });
    }
    try {
      const res = await backend(`/research/studies/${studyId}/analytics`);
      if (!res.ok) {
        return fail(res.status, "Failed to retrieve study analytics.");
      }
      const data = await res.json();
      return Response.json(data, { headers });
    } catch {
      return fail(500, "Research analytics endpoint unavailable.");
    }
  }

  // Route: /api/admin/research/studies/[study_id]/exports/[dataset]
  if (segments.length === 4 && segments[0] === "studies" && uuidRegex.test(segments[1]) && segments[2] === "exports") {
    const studyId = segments[1];
    const dataset = segments[3];

    if (dataset === "data-dictionary") {
      if (isDemo) {
        const demoDict = {
          title: "FLUENTT Experimental Research Data Dictionary",
          version: "1.0.0",
          protocol_version: "v1.2-irb-approved",
          description: "Variable definitions, data types, measurement windows, and missing-data codes for FLUENTT experimental studies.",
          missing_data_codes: {
            NA: "Not applicable (e.g. withdrawal before post-test, or control condition for experimental-only metrics)",
            WITHDRAWN: "Participant withdrew consent prior to completion",
            EXCLUDED: "Participant excluded per protocol criteria",
          },
          privacy_rules: {
            pseudonymization: "Participant codes (e.g. P-TAG-001001) are permanently unlinked from user accounts in exports.",
            formula_injection_defense: "All text cells beginning with =, +, -, @, \\t, \\r, % are prepended with a single quote.",
            small_cell_policy: "Aggregates with N < 5 are flagged and restricted from public reporting.",
          },
          variables: [
            { name: "participant_code", type: "string", description: "Stable pseudonymous research participant code" },
            { name: "study_code", type: "string", description: "Approved research study protocol identifier" },
            { name: "condition", type: "string", description: "Allocated experimental condition: sm2_control or esr_experimental" },
            { name: "enrollment_status", type: "string", description: "Current enrollment state: enrolled, completed, or withdrawn" },
            { name: "pre_test_score", type: "float", description: "Score obtained on pre-intervention baseline assessment" },
            { name: "post_test_score", type: "float", description: "Score obtained on immediate post-intervention assessment" },
            { name: "delayed_retention_score", type: "float", description: "Score obtained on 14-day delayed retention assessment" },
            { name: "pronunciation_score", type: "float", description: "Score obtained on automated pronunciation test" },
            { name: "absolute_learning_gain", type: "float", description: "Raw score difference: post_test_score - pre_test_score" },
            { name: "normalized_learning_gain", type: "float", description: "Hake's normalized gain: (post - pre) / (max - pre)" },
            { name: "retention_loss", type: "float", description: "Score decay: post_test_score - delayed_retention_score" },
          ],
        };
        return Response.json(demoDict, { headers });
      }
      try {
        const res = await backend(`/research/studies/${studyId}/exports/data-dictionary`);
        if (!res.ok) return fail(res.status, "Failed to retrieve data dictionary.");
        const data = await res.json();
        return Response.json(data, { headers });
      } catch {
        return fail(500, "Data dictionary endpoint unavailable.");
      }
    }

    if (["participants.csv", "assessments.csv", "reviews.csv"].includes(dataset)) {
      if (isDemo) {
        let content = DEMO_PARTICIPANTS_CSV;
        if (dataset === "assessments.csv") content = DEMO_ASSESSMENTS_CSV;
        if (dataset === "reviews.csv") content = DEMO_REVIEWS_CSV;

        return new Response(content, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="fluentt_demo_${dataset}"`,
            "Cache-Control": "no-store",
          },
        });
      }

      try {
        const res = await backend(`/research/studies/${studyId}/exports/${dataset}`);
        if (!res.ok) return fail(res.status, `Failed to export ${dataset}.`);
        const text = await res.text();
        const disposition = res.headers.get("content-disposition") || `attachment; filename="fluentt_${studyId}_${dataset}"`;
        return new Response(text, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": disposition,
            "Cache-Control": "no-store",
          },
        });
      } catch {
        return fail(500, `Dataset export for ${dataset} unavailable.`);
      }
    }
  }

  return fail(404, "Research endpoint not found.");
}


async function mutation(request: NextRequest, context: { params: Promise<{ segments?: string[] }> }) {
  const { segments = [] } = await context.params;
  return proxyResearchSetup(request, segments[0] === "classrooms" ? segments.slice(1) : [], { backend, webOrigin, adminCookieNames });
}
export { mutation as POST, mutation as PUT, mutation as PATCH, mutation as DELETE };
