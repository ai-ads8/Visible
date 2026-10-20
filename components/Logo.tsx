export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.22" />
      <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="#5a3cf0" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4.2" fill="#5a3cf0" />
    </svg>
  );
}

export function Logo() {
  return (
    <a href="/" className="logo" aria-label="Visible home">
      <Mark />
      Visible
    </a>
  );
}
