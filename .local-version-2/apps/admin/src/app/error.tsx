"use client";
import { Button } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="shell">
      <h1>Something went wrong</h1>
      <p role="alert">Please try loading this page again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
