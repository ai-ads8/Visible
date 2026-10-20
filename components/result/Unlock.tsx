import type { ScanView } from "@/lib/view";

export function Unlock({ view }: { view: ScanView }) {
  const signedIn = view.access.signedIn;
  const owner = view.access.owner;
  return (
    <div className="unlock">
      <h2 style={{ fontSize: 26 }}>See the full picture</h2>
      <p>Every AI answer in full, every competitor, your complete fix list, and checks every week to see if it&apos;s working.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a className="btn" href={signedIn ? "/pricing" : `/signup?scan=${view.id}`}>{signedIn ? "See plans" : "Unlock my report"}</a>
        {!signedIn && view.access.control && <a className="btn quiet" href={`/signup?scan=${view.id}&plan=free`}>Save it for free</a>}
        {signedIn && !owner && view.access.control && <a className="btn quiet" href="/dashboard">Go to dashboard</a>}
      </div>
    </div>
  );
}
