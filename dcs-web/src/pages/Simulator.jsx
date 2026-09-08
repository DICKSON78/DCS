import { useState } from "react";
import { dcsRequest } from "../lib/api.js";
import { useCredentials } from "../lib/credentials.jsx";
import DecisionBadge from "../components/DecisionBadge.jsx";

const RECIPIENTS = [
  { value: "255712345678", label: "255712345678 — Juma Mohamed (mature account)" },
  { value: "255712345679", label: "255712345679 — Amina Hassan (12-day account)" },
  { value: "255712345680", label: "255712345680 — Baraka Mwinyi (established account)" },
  { value: "255714567890", label: "255714567890 — Daudi Kileo (2-day account)" },
];

const CHANNELS = ["mobile_money", "bank", "internet", "ussd", "pos", "qr"];

const DEFAULTS = {
  tenant_txn_ref: "SIM-" + Date.now(),
  user_external_ref: "2557000777",
  amount: 250000,
  currency: "TZS",
  channel: "mobile_money",
  recipient_external_ref: "255712345678",
  device_fingerprint: "device-a1b2c3",
  occurred_at: new Date().toISOString().slice(0, 16),
};

export default function Simulator() {
  const { creds } = useCredentials();
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        ...form,
        tenant_txn_ref: form.tenant_txn_ref || "SIM-" + Date.now(),
        amount: Number(form.amount),
        currency: form.currency.toUpperCase().slice(0, 3),
        occurred_at: form.occurred_at ? new Date(form.occurred_at).toISOString() : new Date().toISOString(),
      };
      const res = await dcsRequest({
        baseUrl: creds.baseUrl,
        method: "POST",
        path: "/v1/transactions/validate",
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

  const riskColor =
    result?.body?.risk_score >= 80
      ? "var(--danger)"
      : result?.body?.risk_score >= 60
        ? "#fb923c"
        : result?.body?.risk_score >= 25
          ? "var(--warning)"
          : "var(--accent)";

  return (
    <section className="section-pad">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Transaction simulator</span>
          <h2>Score a transaction before it settles</h2>
          <p>
            Send a signed request to <code className="mono">POST /v1/transactions/validate</code>.
            The engine compares this transfer against the customer's own behavioural baseline —
            amount, time, device, recipients and velocity — and returns one of four decisions.
          </p>
        </div>

        <div className="cred-bar">
          <span className="dot" />
          <span>
            Sending signed requests to <b className="mono">{creds.baseUrl}</b> as tenant{" "}
            <b className="mono">{creds.apiKey}</b> — HMAC-SHA256 + fresh nonce each call.
          </span>
        </div>

        <div className="card">
          <div className="form-grid">
            <div className="field">
              <label>Transaction reference</label>
              <input value={form.tenant_txn_ref} onChange={set("tenant_txn_ref")} />
            </div>
            <div className="field">
              <label>Customer (sender)</label>
              <input value={form.user_external_ref} onChange={set("user_external_ref")} />
            </div>
            <div className="field">
              <label>Amount (TZS)</label>
              <input type="number" value={form.amount} onChange={set("amount")} />
            </div>
            <div className="field">
              <label>Channel</label>
              <select value={form.channel} onChange={set("channel")}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Recipient</label>
              <select value={form.recipient_external_ref} onChange={set("recipient_external_ref")}>
                {RECIPIENTS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Device fingerprint</label>
              <input value={form.device_fingerprint} onChange={set("device_fingerprint")} placeholder="device-…" />
            </div>
            <div className="field">
              <label>When</label>
              <input type="datetime-local" value={form.occurred_at} onChange={set("occurred_at")} />
            </div>
          </div>

          <button className="btn mt" onClick={run} disabled={loading}>
            {loading ? <span className="spinner" /> : <i className="fa-solid fa-bolt" />}
            {loading ? "Scoring…" : "Score this transaction"}
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
              <h3>Decision</h3>
              <DecisionBadge decision={result.body.decision} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, .8fr) 1.4fr", gap: 28, flexWrap: "wrap" }}>
              <div>
                <div className="score" style={{ color: riskColor }}>
                  {typeof result.body.risk_score === "number" ? result.body.risk_score.toFixed(1) : "—"}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  risk score (0–100)
                </div>

                <dl className="mt">
                  <div className="metric">
                    <dt>transaction_id</dt>
                    <dd className="mono">{result.body.transaction_id}</dd>
                  </div>
                  <div className="metric">
                    <dt>model_version</dt>
                    <dd className="mono">{result.body.model_version}</dd>
                  </div>
                  {result.body.hold && (
                    <>
                      <div className="metric">
                        <dt>hold_id</dt>
                        <dd className="mono">{result.body.hold.hold_id}</dd>
                      </div>
                      <div className="metric">
                        <dt>hold ttl</dt>
                        <dd className="mono">{result.body.hold.ttl_seconds}s</dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>

              <div>
                <h3 className="muted" style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                  Fraud signals that fired
                </h3>
                {(result.body.reason_codes || []).length > 0 ? (
                  (result.body.reason_codes || []).map((c) => (
                    <span
                      key={c}
                      className={
                        "chip " +
                        (c.includes("BLOCK") || c.includes("TRUST") ? "chip-danger" : c.includes("NEW") || c.includes("COLD") || c.includes("DEVICE") || c.includes("VELOCITY") || c.includes("MULTI") ? "chip-warning" : "chip-neutral")
                      }
                    >
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="chip chip-neutral">No signals</span>
                )}

                {result.body.advisory && (
                  <div className="banner banner-info mt">
                    <i className="fa-solid fa-circle-info" /> {result.body.advisory.message}
                  </div>
                )}

                <h3 className="muted" style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", margin: "18px 0 8px" }}>
                  Raw response
                </h3>
                <code className="block-kv">{JSON.stringify(result.body, null, 2)}</code>
              </div>
            </div>
          </div>
        )}

        <div className="card mt" style={{ marginTop: 28 }}>
          <h3>
            <i className="fa-solid fa-lightbulb" style={{ color: "var(--accent)" }} /> How to trigger each outcome
          </h3>
          <ul className="muted" style={{ lineHeight: 2 }}>
            <li>
              <b className="mono" style={{ color: "var(--text)" }}>warn</b> — use a large, untypical amount, or a
              brand-new customer on day zero.
            </li>
            <li>
              <b className="mono" style={{ color: "var(--text)" }}>hold</b> — send 5 small transfers with the same
              customer, then a 6th from a <i>different device fingerprint</i>.
            </li>
            <li>
              <b className="mono" style={{ color: "var(--text)" }}>block</b> — a very large amount far above the
              customer's baseline plus a changed device.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}