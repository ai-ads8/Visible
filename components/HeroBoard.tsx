/* Homepage illustration: a scoreboard resolving row by row. Fictional businesses, labelled as an example. */
const ROWS: { q: string; s: "named" | "absent" | "linked"; pos?: number; rivals: string[] }[] = [
  { q: "Best dentist in Austin?", s: "absent", rivals: ["Brightside Dental", "Maple Family"] },
  { q: "Emergency dentist open on Saturday", s: "named", pos: 2, rivals: [] },
  { q: "How much is teeth whitening in Austin?", s: "absent", rivals: ["Riverside Smile"] },
  { q: "Dentist for nervous patients near me", s: "linked", rivals: ["Brightside Dental"] },
  { q: "Invisalign dentist with payment plans", s: "absent", rivals: ["Oak Hill Ortho"] },
];
const LABEL = { named: "Won", absent: "Lost", linked: "Source only" };

export function HeroBoard() {
  return (
    <figure className="heroboard" style={{ margin: 0 }} aria-label="Example scoreboard with fictional businesses: won 1 of 5 customer questions">
      <span className="tag">Example, fictional businesses</span>
      <div className="board">
        <div className="board-head">
          <div>
            <h2 style={{ fontSize: 20 }}>Lakeside Dental Studio</h2>
            <p className="sub">5 questions customers ask ChatGPT</p>
          </div>
          <div>
            <div className="tally"><span className="w">1</span><span className="sep">–</span><span className="l">4</span></div>
            <p className="tally-label">won – lost</p>
          </div>
        </div>
        <ol className="brows">
          {ROWS.map((r, i) => (
            <li key={r.q} className={`brow ${r.s}`} style={{ animationDelay: `${0.25 + i * 0.32}s` }}>
              <span className="num">{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <p className="q">{r.q}</p>
                {r.rivals.length > 0 && (
                  <div className="meta">
                    <span>{r.s === "named" ? "Also named" : "AI picked"}</span>
                    <span className="rivals">{r.rivals.map((n) => <span className="rival" key={n}>{n}</span>)}</span>
                  </div>
                )}
              </div>
              <div className="side">
                <span className={`verdict-chip ${r.s}`} style={{ animationDelay: `${0.55 + i * 0.32}s` }}>{LABEL[r.s]}{r.pos ? ` · #${r.pos}` : ""}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="fixcard" aria-hidden="true">
        <b>Page agent is writing</b>
        <span>“Teeth whitening in Austin” — to win question 3</span>
        <div className="bar"><i /></div>
      </div>
    </figure>
  );
}
