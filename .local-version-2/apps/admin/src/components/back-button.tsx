"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();
  return <div className="shell global-back"><button type="button" className="back-button" aria-label="Go back to the previous screen" onClick={() => {
    const proceed = () => { if (window.history.length > 1) router.back(); else router.push("/"); };
    // Editors can retain their existing busy/unsaved-change confirmation flow.
    const event = new CustomEvent("fluentt:before-back", { cancelable: true, detail: { proceed } });
    if (document.dispatchEvent(event)) proceed();
  }}><span aria-hidden="true">←</span> Back</button></div>;
}
