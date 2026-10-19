"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <main className="shell auth-content"><h1>Unable to verify access</h1>
    <p role="alert">The account service is unavailable. Retry to verify your administrator session.</p>
    <button className="button" onClick={reset}>Retry</button> <a href="/login">Return to sign-in</a></main>;
}
