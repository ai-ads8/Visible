"use client";
import { useMemo, useState } from "react";
import type { ScanView } from "@/lib/view";

const COUNTRIES = "US GB CA AU NZ IE NL BE DE FR ES IT PT AT CH SE NO DK FI PL CZ GR TR AE SA IL ZA NG KE EG IN PK SG MY TH PH ID VN JP KR CN HK TW MX BR AR CL CO PE".split(" ");

export function ConfirmCard({ view, onSaved }: { view: ScanView; onSaved: () => Promise<unknown> }) {
  const p = view.profile;
  const [f, setF] = useState({ name: p.name, category: p.category, service: p.service, city: p.city, country: p.country, reach: p.reach });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const names = useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {}
    const list = COUNTRIES.includes(p.country) ? COUNTRIES : [p.country, ...COUNTRIES];
    return list.map((c) => ({ c, n: dn?.of(c) || c })).sort((a, b) => a.n.localeCompare(b.n));
  }, [p.country]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch(`/api/scan/${view.id}/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(false);
      return setError(j.error || "Couldn't save. Try again.");
    }
    await onSaved();
    setBusy(false);
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form className="card" onSubmit={save}>
      <h2>Is this right?</h2>
      <p className="sub">We ask AI the questions your customers would ask, so we need to know what you do and where.</p>
      <div className="confirm">
        <label className="field">
          <span>Business name</span>
          <input className="input" value={f.name} onChange={set("name")} required maxLength={80} />
        </label>
        <div className="two">
          <label className="field">
            <span>What kind of business?</span>
            <input className="input" value={f.category} onChange={set("category")} placeholder="e.g. dentist, bakery, plumber" required maxLength={60} />
          </label>
          <label className="field">
            <span>Main service <span className="muted" style={{ display: "inline", fontWeight: 400 }}>(optional)</span></span>
            <input className="input" value={f.service} onChange={set("service")} placeholder="e.g. teeth whitening" maxLength={60} />
          </label>
        </div>
        <div>
          <span className="small" style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Where are your customers?</span>
          <div className="toggle" role="group" aria-label="Where are your customers?">
            <button type="button" aria-pressed={f.reach === "local"} onClick={() => setF({ ...f, reach: "local" })}>In my area</button>
            <button type="button" aria-pressed={f.reach === "online"} onClick={() => setF({ ...f, reach: "online" })}>Online, anywhere</button>
          </div>
        </div>
        <div className="two">
          {f.reach === "local" && (
            <label className="field">
              <span>City or area</span>
              <input className="input" value={f.city} onChange={set("city")} placeholder="e.g. Austin" required maxLength={60} />
            </label>
          )}
          <label className="field">
            <span>Country</span>
            <select className="select" value={f.country} onChange={set("country")}>
              {names.map(({ c, n }) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
        </div>
        <div>
          <button className="btn" disabled={busy}>{busy ? "Saving…" : "Looks right"}</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </form>
  );
}
