import { NavLink } from "react-router-dom";
import { useCredentials } from "../lib/credentials.jsx";

export default function SiteHeader() {
  const { setOpen } = useCredentials();

  return (
    <header className="site-header">
      <div className="container">
        <NavLink to="/" className="logo">
          <span className="logo-icon">
            <i className="fa-solid fa-shield-halved" />
          </span>
          Digital Consumer Shield
        </NavLink>

        <nav className="nav">
          <NavLink to="/simulator" className={({ isActive }) => (isActive ? "active" : "")}>
            Simulator
          </NavLink>
          <NavLink to="/verify" className={({ isActive }) => (isActive ? "active" : "")}>
            Verify
          </NavLink>
          <NavLink to="/ops" className={({ isActive }) => (isActive ? "active" : "")}>
            Ops
          </NavLink>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
            title="API connection settings"
          >
            <i className="fa-solid fa-plug" />
          </a>
        </nav>
      </div>
    </header>
  );
}