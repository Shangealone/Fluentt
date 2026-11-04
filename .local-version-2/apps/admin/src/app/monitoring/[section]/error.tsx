"use client";

export default function MonitoringError({ reset }: { reset: () => void }) {
  return <main className="shell auth-content"><h1>Monitoring unavailable</h1>
    <p role="alert">The account or monitoring service could not provide this view. Your records were not changed.</p>
    <button className="button" onClick={reset}>Retry</button> <a href="/dashboard">Return to dashboard</a></main>;
}
