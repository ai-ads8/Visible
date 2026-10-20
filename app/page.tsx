import { ScanForm } from "@/components/ScanForm";
import { ChatIllustration } from "@/components/ChatIllustration";
import { PlanCards } from "@/components/PlanCards";
import { FAQ } from "@/lib/content";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="copy">
            <h1>Your competitors show up in AI. Do you?</h1>
            <p className="lede">See if ChatGPT and other AI tools recommend your business, discover what&apos;s missing, and know exactly what to improve.</p>
            <ScanForm id="scan" />
          </div>
          <ChatIllustration />
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <div className="section-head">
            <h2>How it works</h2>
            <p>Three steps. No setup, no jargon.</p>
          </div>
          <ol className="steps">
            <li>
              <h3>Enter your website</h3>
              <p>We read your site the way AI tools do and check what they can find about you.</p>
            </li>
            <li>
              <h3>We ask AI what your customers ask</h3>
              <p>Questions like “best plumber in my town”, asked to ChatGPT with live search.</p>
            </li>
            <li>
              <h3>See where you stand</h3>
              <p>Whether AI names you, who it picks instead, and the fixes that matter most.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section band">
        <div className="wrap split">
          <div>
            <h2>Customers ask AI now. It names only a few.</h2>
            <div className="points">
              <div>
                <h3>One short answer, not ten pages</h3>
                <p>An AI assistant usually recommends a handful of businesses. If you&apos;re not one of them, you&apos;re invisible for that customer.</p>
              </div>
              <div>
                <h3>AI picks what it can understand</h3>
                <p>Clear services, location, reviews and answers on your website make it easier for AI to choose you.</p>
              </div>
              <div>
                <h3>You can see it, and fix it</h3>
                <p>Visible shows the real answers and tells you, in plain words, what to change first.</p>
              </div>
            </div>
          </div>
          <ExampleReport />
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="wrap">
          <div className="section-head">
            <h2>Start free. Upgrade when you want to track it.</h2>
            <p>Monthly plans, cancel any time.</p>
          </div>
          <PlanCards />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head"><h2>Questions</h2></div>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta-final">
            <h2>Find out in 30 seconds.</h2>
            <p>Free scan. No sign-up needed.</p>
            <ScanForm id="scan-bottom" dark />
          </div>
        </div>
      </section>
    </>
  );
}

/* A labelled example of the report, with fictional businesses. */
function ExampleReport() {
  const dots = ["named", "absent", "absent", "named", "absent", "absent", "absent", "absent"];
  const rows = [
    { n: "Brightside Dental", c: 6 },
    { n: "Maple Family Dentistry", c: 5 },
    { n: "Your business", c: 2, you: true },
    { n: "Riverside Smile Studio", c: 2 },
  ];
  return (
    <figure className="card" style={{ margin: 0 }} aria-label="Example report with fictional businesses">
      <p className="small muted">Example report</p>
      <div className="verdict" style={{ marginTop: 12, padding: 22 }}>
        <div className="big" style={{ fontSize: 64 }}>2<span>/8</span></div>
        <p className="line" style={{ fontSize: 17 }}>AI named you in 2 of 8 customer questions.</p>
        <div className="dots" aria-hidden="true">
          {dots.map((d, i) => <span key={i} className={`dot ${d}`} style={{ width: 22, height: 22 }} />)}
        </div>
      </div>
      <h3 style={{ marginTop: 22, fontSize: 17 }}>Who AI recommends</h3>
      <ul className="rank">
        {rows.map((r) => (
          <li key={r.n} className={r.you ? "you" : ""}>
            <span className="name">{r.n}</span>
            <span className="count">{r.c} of 8</span>
            <span className="bar"><b style={{ width: `${(r.c / 8) * 100}%` }} /></span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
