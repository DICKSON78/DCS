import { useState } from "react";
import { dcsRequest } from "../lib/api.js";
import { useCredentials } from "../lib/credentials.jsx";

const TEST_REFS = [
  "255712345678",
  "255712345679",
  "255712345680",
  "255714567890",
];

export default function Verify() {
  const { creds } = useCredentials();
  const [ref, setRef] = useState("255712345678");
  const [channel, setChannel] = useState("mobile_money");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        recipient_external_ref: ref.trim(),
        channel,
        tenant_txn_ref: "VR-" + Date.now(),
      };
      const res = await dcsRequest({
        baseUrl: creds.baseUrl,
        method: "POST",
        path: "/v1/recipients/verify",
        payload,
        apiKey: creds.apiKey,
        signingSecret: creds.signingSecret,
      });
      setResult(res);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  const flags = [];
  if (result?.body) {
    if (result.body.account_age_days != null && result.body.account_age_days < 30)
      flags.push({ text: "New account", cls: "chip-warning", icon: "fa-clock" });
    if (result.body.first_time_recipient)
      flags.push({ text: "First-time recipient", cls: "chip-warning", icon: "fa-circle-exclamation" });
    if (result.body.verified === false)
      flags.push({ text: "Number not found / unverifiable", cls: "chip-danger", icon: "fa-xmark" });
    if (result.body.fraud_flagged)
      flags.push({ text: "Fraud-flagged recipient", cls: "chip-danger", icon: "fa-triangle-exclamation" });
    if (flags.length === 0 && result.body.verified)
      flags.push({ text: "No flags", cls: "chip-neutral", icon: "fa-check" });
  }

  return (
    <section className="section-pad">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Recipient verification</span>
          <h2>Check who you are about to pay</h2>
          <p>
            ONE of the two big causes of money loss is paying the wrong number. Before sending,
            the gateway asks DCS to resolve the number to a masked, registered name — so the
            customer can confirm, "yes, I know Juma Mohamed" — and flags young or first-time
            accounts.
          </p>
        </div>

        <div className="cred-bar">
          <span className="dot" />
          <span>
            Sends a signed request to <b className="mono">POST /v1/recipients/verify</b> as{" "}
            <b className="mono">{creds.apiKey}</b>.
          </span>
        </div>

        <div className="card">
          <div className="form-grid">
            <div className="field">
              <label>Recipient number</label>
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="2557…"
                style={{ width: "100%" }}
              />
            </div>
            <div className="field">
              <label>Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                {["mobile_money", "bank", "internet"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Try a sandbox number</label>
              <select
                value=""
                onChange={(e) => e.target.value && setRef(e.target.value)}
              >
                <option value="">— pick a test account —</option>
                {TEST_REFS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button className="btn mt" onClick={run} disabled={loading}>
            {loading ? <span className="spinner" /> : <i className="fa-solid fa-user-check" />}
            {loading ? "Verifying…" : "Verify recipient"}
          </button>
        </div>

        {error && (
          <div className="result">
            <div className="banner banner-danger">
              <i className="fa-solid fa-circle-exclamation" /> {error}
            </div>
          </div>
        )}

        {result?.body && (
          <div className="result">
            <div className="result-header">
              <h3>Recipient</h3>
              <span
                className={
                  "badge " + (result.body.verified === false ? "badge-block" : "badge-allow")
                }
              >
                <i className="fa-solid fa-circle" style={{ fontSize: 7 }} />
                {result.body.verified === false ? "NOT VERIFIED" : "VERIFIED"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, .9fr) 1.4fr", gap: 28 }}>
              <dl>
                <div className="metric">
                  <dt>Registered name</dt>
                  <dd className="mono">{result.body.recipient_display_name || "—"}</dd>
                </div>
                <div className="metric">
                  <dt>Account age</dt>
                  <dd className="mono">
                    {result.body.account_age_days != null
                      ? `${result.body.account_age_days} days`
                      : "—"}
                  </dd>
                </div>
                <div className="metric">
                  <dt>First-time recipient</dt>
                  <dd className="mono">{result.body.first_time_recipient ? "yes" : "no"}</dd>
                </div>
                <div className="metric">
                  <dt>Channel</dt>
                  <dd className="mono">{result.body.channel || channel}</dd>
                </div>
              </dl>

              <div>
                <h3 className="muted" style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                  Flags
                </h3>
                {flags.map((f) => (
                  <span key={f.text} className={"chip " + f.cls}>
                    <i className={"fa-solid " + f.icon} style={{ marginRight: 5 }} />
                    {f.text}
                  </span>
                ))}
                <h3 className="muted" style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", margin: "18px 0 8px" }}>
                  Raw response
                </h3>
                <code className="block-kv">{JSON.stringify(result.body, null, 2)}</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}