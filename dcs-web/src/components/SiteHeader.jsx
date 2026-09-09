import { useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useCredentials } from "../lib/credentials.jsx";

const NAV_ITEMS = [
  { to: "/simulator", label: "Simulator" },
  { to: "/verify", label: "Verify" },
  { to: "/ops", label: "Ops" },
  { to: "/docs", label: "API docs" },
];

export default function SiteHeader({ menuOpen, setMenuOpen }) {
  const { setOpen } = useCredentials();
  const location = useLocation();

  useEffect(() => {
    const nav = document.querySelector(".navbar");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, setMenuOpen]);

  function toggleMenu() {
    setMenuOpen((v) => !v);
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <i className="fa-solid fa-shield-halved" />
          </span>
          Digital Consumer Shield
        </Link>

        <ul className="nav-links">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to}>{item.label}</NavLink>
            </li>
          ))}
        </ul>

        <div className="nav-cta">
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
            <i className="fa-solid fa-plug" /> Connection
          </button>
          <Link to="/simulator" className="btn btn-sm">
            Try it now
          </Link>
        </div>

        <button className="menu-toggle" aria-label="Menu" onClick={toggleMenu}>
          <i className="fa-solid fa-bars" />
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-menu" style={{ display: "block" }}>
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to}>
              {item.label}
            </Link>
          ))}
          <Link to="/" className="btn">
            Home
          </Link>
        </div>
      )}
    </nav>
  );
}