import { Mark } from "./Logo";

/* Illustration of the problem: AI names three businesses, and yours isn't one of them. Fictional names, labelled. */
export function ChatIllustration() {
  return (
    <figure className="chat" style={{ margin: 0, paddingTop: 40 }} aria-label="Illustration: an AI assistant recommends three competitors and not your business">
      <span className="tag">Illustration</span>
      <div className="ask">What&apos;s the best dentist near me?</div>
      <div className="reply">
        <div className="ai"><Mark size={16} /> AI assistant</div>
        <p>Here are three dentists people in your area recommend:</p>
        <ol>
          <li><span className="n">1</span>Brightside Dental</li>
          <li><span className="n">2</span>Maple Family Dentistry</li>
          <li><span className="n">3</span>Riverside Smile Studio</li>
          <li className="you you-missing"><span className="n">?</span>Your business isn&apos;t mentioned</li>
        </ol>
      </div>
    </figure>
  );
}
