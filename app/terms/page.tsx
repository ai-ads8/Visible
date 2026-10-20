import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <section className="page">
      <div className="wrap prose">
        <h1>Terms</h1>
        <p className="muted" style={{ marginTop: 10 }}>Draft — to be reviewed before launch.</p>
        <h2>What Visible is</h2>
        <p>Visible shows how AI assistants answer questions related to your business and how ready your website is for them. AI tools decide for themselves what to recommend; we can&apos;t guarantee any result.</p>
        <h2>Fair use</h2>
        <p>Only scan websites you own or are allowed to analyse. Don&apos;t use Visible to overload or attack websites.</p>
        <h2>Subscriptions</h2>
        <p>Paid plans renew monthly until you cancel. You can cancel any time from your dashboard; your plan stays active until the end of the paid period.</p>
      </div>
    </section>
  );
}
