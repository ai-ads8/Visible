"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ScanForm } from "../ScanForm";

const STEPS = ["Opening your website", "Reading your pages", "Checking what AI can see", "Finding what's missing"];

export function Scanning() {
  const url = useSearchParams().get("url") || "";
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !url) return;
    started.current = true;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2600);
    fetch("/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.id) throw new Error(j.error || "We couldn't read your website. Check the address and try again.");
        router.replace(`/scan/${j.id}`);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => clearInterval(t));
    return () => clearInterval(t);
  }, [url, router]);

  if (!url || error)
    return (
      <section className="scanning">
        <div className="wrap" style={{ maxWidth: 640 }}>
          <h1 style={{ fontSize: 40 }}>{error ? "We couldn't scan that site" : "Scan your website"}</h1>
          {error && <p className="lede" style={{ marginTop: 14 }}>{error}</p>}
          <div style={{ marginTop: 24 }}><ScanForm id="retry" /></div>
        </div>
      </section>
    );

  return (
    <section className="scanning" aria-live="polite">
      <div className="wrap" style={{ maxWidth: 640 }}>
        <p className="muted">{url.replace(/^https?:\/\//, "")}</p>
        <h1 style={{ fontSize: 40, marginTop: 8 }}>Reading your website…</h1>
        <div className="lines">
          {STEPS.map((s, i) => <div key={s} className={i <= step ? "on" : ""}>{s}</div>)}
        </div>
      </div>
    </section>
  );
}
