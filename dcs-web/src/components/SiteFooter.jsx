import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link to="/" className="brand">
              <span className="brand-mark">
                <i className="fa-solid fa-shield-halved" />
              </span>
              Digital Consumer Shield
            </Link>
            <p>Real-time payment protection for Tanzania's financial corridors — banks, mobile money, GePG and TIPS.</p>
          </div>

          <div className="footer-col">
            <h5>Product</h5>
            <Link to="/">Overview</Link>
            <Link to="/simulator">Transaction simulator</Link>
            <Link to="/verify">Recipient verification</Link>
            <Link to="/ops">Ops console</Link>
          </div>

          <div className="footer-col">
            <h5>Developers</h5>
            <Link to="/docs">Documentation</Link>
            <Link to="/docs">Quickstart</Link>
            <Link to="/docs">API reference</Link>
            <Link to="/docs">Decision model</Link>
          </div>

          <div className="footer-col">
            <h5>Project</h5>
            <a href="https://github.com/DICKSON78/DCS" target="_blank" rel="noreferrer">GitHub</a>
            <a href="https://github.com/DICKSON78/DCS" target="_blank" rel="noreferrer">Release notes</a>
            <Link to="/docs">Sandbox &amp; testing</Link>
            <Link to="/docs">Support</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Digital Consumer Shield · Dr. Mshindi Andrew Rwamuhuru. All rights reserved.</span>
          <div className="socials">
            <a href="https://github.com/DICKSON78/DCS" target="_blank" rel="noreferrer" aria-label="GitHub"><i className="fa-brands fa-github" /></a>
            <a href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><i className="fa-brands fa-linkedin" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}