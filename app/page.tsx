import { ScanForm } from "@/components/ScanForm";
import { HeroBoard } from "@/components/HeroBoard";
import { PlanCards } from "@/components/PlanCards";
import { FAQ } from "@/lib/content";
import { CREW, ICON } from "@/components/agentsMeta";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="copy">
            <h1>Your competitors show up in AI. Do you?</h1>
            <p className="lede">See every question your customers ask ChatGPT, which ones you win, and who takes the rest. Then Visible writes the pages that win them back.</p>
            <ScanForm id="scan" />
            <div className="proof">
              <span><i />Real ChatGPT answers, with live web search</span>
              <span><i />Nothing goes on your site without your OK</span>
            </div>
          </div>
          <HeroBoard />
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <div className="section-head">
            <h2>From invisible to named, in four steps</h2>
            <p>No setup and no jargon. You see the real answers, and you see them change.</p>
          </div>
          <ol className="loop">
            <li><h3>Scan your website</h3><p>We read your site the way AI tools do: what you offer, where, and what&apos;s missing.</p></li>
            <li><h3>See your scoreboard</h3><p>We ask ChatGPT the questions your customers ask. Each one is won, lost, or a near miss.</p></li>
            <li><h3>Win the questions you lose</h3><p>The page agent writes one page per lost question, from your own site. You approve and publish.</p></li>
            <li><h3>Watch the score move</h3><p>Every check asks the same questions again, so you see which pages turned a loss into a win.</p></li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="wrap feature flip">
          <div className="copy">
            <h2>A page for every question you lose</h2>
            <p>AI recommends the business whose website answers the question best. So for each lost question, the page agent writes exactly that page.</p>
            <ul className="ticks">
              <li>The answer AI can quote comes first, with your name and town</li>
              <li>Written only from your website; gaps are left for you to fill in</li>
              <li>Approve it, then publish to WordPress or Shopify in one click</li>
              <li>Competitors are never mentioned on your page</li>
            </ul>
          </div>
          <div className="pageshot" aria-label="Example page written by the page agent, fictional business">
            <div className="bar"><span className="dots3"><i /><i /><i /></span>lakesidedental.com/teeth-whitening-austin</div>
            <div className="body">
              <h3>Teeth whitening in Austin</h3>
              <p className="ans">Lakeside Dental Studio offers in-chair teeth whitening in Austin, done in one visit of about 90 minutes by our own dentists.</p>
              <div className="ln" style={{ width: "94%" }} />
              <div className="ln" style={{ width: "82%" }} />
              <div className="ln" style={{ width: "88%" }} />
              <div className="ln" style={{ width: "60%" }} />
            </div>
            <div className="foot"><span>For “How much is teeth whitening in Austin?”</span><span className="wp-state published">Live</span></div>
          </div>
        </div>
      </section>

      <section className="section" id="agents">
        <div className="wrap">
          <div className="section-head">
            <h2>Four agents, one job: get you named</h2>
            <p>Each one does a single thing well, using your own website and your real Google reviews. Nothing is made up.</p>
          </div>
          <div className="crew">
            {CREW.map((a) => (
              <article key={a.id} className={`crew-card a-${a.id}`}>
                <div className="avatar">{ICON[a.id]}</div>
                <div><h3>{a.name}</h3><p className="role">{a.role}</p></div>
                <ul>{a.does.map((d) => <li key={d}>{d}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="wrap">
          <div className="section-head">
            <h2>Start free. Start winning when you&apos;re ready.</h2>
            <p>Monthly plans in euros. Cancel any time.</p>
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

      <section className="section tight">
        <div className="wrap">
          <div className="cta-final">
            <h2>See your scoreboard in a minute.</h2>
            <p>Free scan, no sign-up needed.</p>
            <ScanForm id="scan-bottom" dark />
          </div>
        </div>
      </section>
    </>
  );
}
