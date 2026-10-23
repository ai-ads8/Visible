import { Logo } from "./Logo";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <Logo />
        <nav className="nav" aria-label="Main">
          <a className="hide-sm" href="/#how">How it works</a>
          <a className="hide-sm" href="/#agents">AI agents</a>
          <a className="hide-sm" href="/pricing">Pricing</a>
          {signedIn ? <a href="/dashboard">Dashboard</a> : <a href="/signin">Sign in</a>}
          <a className="btn small" href="/#scan">Scan my website</a>
        </nav>
      </div>
    </header>
  );
}
