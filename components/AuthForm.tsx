"use client";
import { useState } from "react";

export function AuthForm({ mode, scanId, plan }: { mode: "signin" | "signup"; scanId?: string; plan?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, scanId }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(false);
      return setError(j.error || "Something went wrong. Try again.");
    }
    if (mode === "signin" && scanId) await fetch(`/api/scan/${scanId}/claim`, { method: "POST" }).catch(() => {});
    if (plan && plan !== "free") {
      const c = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) });
      const cj = await c.json().catch(() => ({}));
      if (cj.url) return void (location.href = cj.url);
    }
    location.href = scanId ? `/scan/${scanId}` : plan && plan !== "free" ? "/pricing" : "/dashboard";
  }

  return (
    <form className="authform" onSubmit={submit}>
      <label className="field">
        <span>Email</span>
        <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="field">
        <span>Password</span>
        <input className="input" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 10 : 1} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {mode === "signup" && <span className="small muted" style={{ fontWeight: 400, marginTop: 6 }}>At least 10 characters.</span>}
      </label>
      <button className="btn block" disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
