export default function TopBar() {
  return (
    <header className="top">
      <a className="wm" href="/">INTELLI<b>·</b>COIN</a>
      <nav className="nav">
        <a className="hidem" href="#how">How it works</a>
        <a className="hidem" href="/buy">Pricing</a>
        <a className="hidem" href="/admin/login">Sign in</a>
        <a className="cta" href="/buy" style={{ textDecoration: "none" }}>Go Pro</a>
      </nav>
    </header>
  );
}
