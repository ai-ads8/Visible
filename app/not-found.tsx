export default function NotFound() {
  return (
    <div className="narrow">
      <h1>Page not found</h1>
      <p className="muted" style={{ marginTop: 10 }}>The link may be old or mistyped.</p>
      <p style={{ marginTop: 20 }}><a className="btn" href="/">Go to the homepage</a></p>
    </div>
  );
}
