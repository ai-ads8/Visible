import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <section className="page">
      <div className="wrap prose">
        <h1>Privacy</h1>
        <p className="muted" style={{ marginTop: 10 }}>Draft — to be reviewed before launch.</p>
        <h2>What we collect</h2>
        <p>The website address you scan and what is publicly on that website. If you create an account: your email address and a securely hashed password. If you subscribe: your subscription status from our payment provider (we never see your card details).</p>
        <h2>What we do with it</h2>
        <p>We use it to run your scan, ask AI assistants questions about your type of business, and show you the results. We send your business&apos;s type and location — never your personal details — to the AI provider to ask those questions.</p>
        <h2>Cookies</h2>
        <p>Only what&apos;s needed: one cookie to keep you signed in and one to let you continue a scan you started. No advertising or tracking cookies.</p>
        <h2>Your rights</h2>
        <p>You can ask us to export or delete your data at any time.</p>
      </div>
    </section>
  );
}
