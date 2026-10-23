import type { ScanView } from "@/lib/view";

export function Unlock({ view, onAgents }: { view: ScanView; onAgents: () => void }) {
  const signedIn = view.access.signedIn;
  return (
    <div className="unlock">
      <h2 style={{ fontSize: 28 }}>Let your agents fix it</h2>
      <p>Every answer, every competitor, and your GEO, SEO and Social agents working for you.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a className="btn" href={signedIn ? "/pricing" : `/signup?scan=${view.id}&plan=growth`}>Unlock everything</a>
        <button className="btn quiet" type="button" onClick={onAgents}>Meet your agents</button>
        {!signedIn && view.access.control && <a className="btn quiet" href={`/signup?scan=${view.id}&plan=free`}>Save it for free</a>}
      </div>
    </div>
  );
}
