import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <Logo />
        <nav aria-label="Footer">
          <a href="/#how">How it works</a>
          <a href="/pricing">Pricing</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
        <p>Visible shows how AI assistants answer your customers. We don&apos;t control what AI recommends.</p>
      </div>
    </footer>
  );
}
