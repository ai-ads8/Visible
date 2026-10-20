"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ScanForm({ id, dark = false }: { id?: string; dark?: boolean }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (value.length < 3) return setError("Enter your website address.");
    setBusy(true);
    router.push(`/scan/new?url=${encodeURIComponent(value)}`);
  }

  return (
    <form className="scanform" onSubmit={submit} id={id}>
      <div className="row">
        <label className="sr" htmlFor={`${id || "scan"}-url`}>Your website</label>
        <input
          id={`${id || "scan"}-url`}
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="yourbusiness.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          minLength={3}
          style={dark ? { color: "var(--ink)" } : undefined}
        />
        <button className="btn" disabled={busy}>{busy ? "Starting…" : "Scan my website"}</button>
      </div>
      <p className="small" style={{ color: dark ? "#a9a6b6" : "var(--graphite)" }}>Free. No sign-up. Takes about 30 seconds.</p>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
