import { Outlet } from "react-router-dom";
import { useState } from "react";
import { useCredentials } from "../lib/credentials.jsx";
import SiteHeader from "./SiteHeader.jsx";
import SiteFooter from "./SiteFooter.jsx";

export default function SiteLayout() {
  const { creds, setCreds, open, setOpen } = useCredentials();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <SiteHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <Outlet />
      <SiteFooter />

      <div
        className={"drawer" + (open ? " open" : "")}
        aria-label="API connection settings"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3>API Connection</h3>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setOpen(false)}
            aria-label="Close settings"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="field mb">
          <label>API base URL</label>
          <input
            defaultValue={creds.baseUrl}
            onBlur={(e) => setCreds({ ...creds, baseUrl: e.target.value.trim() || creds.baseUrl })}
            placeholder="http://localhost:8080"
          />
        </div>
        <div className="field mb">
          <label>Tenant API key</label>
          <input
            defaultValue={creds.apiKey}
            onBlur={(e) => setCreds({ ...creds, apiKey: e.target.value.trim() || creds.apiKey })}
            placeholder="test-api-key-0001"
          />
        </div>
        <div className="field mb">
          <label>Signing secret</label>
          <input
            defaultValue={creds.signingSecret}
            onBlur={(e) => setCreds({ ...creds, signingSecret: e.target.value.trim() || creds.signingSecret })}
            placeholder="test-signing-key-0001"
          />
        </div>
        <div className="field mb">
          <label>Ops bearer token</label>
          <input
            defaultValue={creds.opsToken}
            onBlur={(e) => setCreds({ ...creds, opsToken: e.target.value.trim() || creds.opsToken })}
            placeholder="ops-secret-token-0001"
          />
        </div>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          Sandbox defaults are pre-filled (test bank tenant). Requests are signed with
          HMAC-SHA256 in the browser and carry a fresh nonce, exactly like the gateway SDK.
        </p>
        <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={() => setOpen(false)}>
          <i className="fa-solid fa-check" /> Save connection
        </button>
      </div>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 90 }}
        />
      )}
    </>
  );
}