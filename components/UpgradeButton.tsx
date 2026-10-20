"use client";
import { useState } from "react";

export function UpgradeButton({ plan, label, featured }: { plan: string; label: string; featured?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) return void (location.href = `/signup?plan=${plan}`);
    if (json.url) return void (location.href = json.url);
    setBusy(false);
    setError(json.error || "Checkout couldn't open.");
  }
  return (
    <div>
      <button className={`btn block${featured ? "" : " quiet"}`} onClick={go} disabled={busy}>{busy ? "Opening…" : label}</button>
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
