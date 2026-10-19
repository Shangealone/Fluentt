"use client";

import { useState } from "react";
import { Button } from "./ui";

export function AdminLogin({ enabled }: { enabled: boolean }) {
  const [pending, setPending] = useState(false);
  return <form method="post" action="/api/admin/start" onSubmit={() => setPending(true)} aria-busy={pending}>
    <p id="sign-in-help">Use your organization’s approved identity provider and multi-factor authentication.
      Only accounts provisioned by an operator can access administration.</p>
    <Button type="submit" disabled={!enabled || pending} aria-describedby="sign-in-help">
      {pending ? "Connecting to identity provider…" : "Continue to secure sign-in"}
    </Button>
    {!enabled && <p role="status">Administrator sign-in is not configured. Contact your operator.</p>}
  </form>;
}
