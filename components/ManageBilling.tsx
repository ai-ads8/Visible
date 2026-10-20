"use client";
import { useState } from "react";

export function ManageBilling() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    setBusy(true);
    const r = await fetch("/api/billing/portal", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (j.url) return void (location.href = j.url);
    setBusy(false);
    setError(j.error || "Couldn't open billing.");
  }
  return (
    <>
      <button className="btn quiet small" onClick={go} disabled={busy}>Manage billing</button>
      {error && <span className="error small"> {error}</span>}
    </>
  );
}
