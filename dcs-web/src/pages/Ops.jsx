import { useState } from "react";
import { dcsRequest } from "../lib/api.js";
import { useCredentials } from "../lib/credentials.jsx";

const TABS = [
  { id: "lookup", label: "Transactions", icon: "fa-magnifying-glass" },
  { id: "holds", label: "Holds", icon: "fa-hand" },
  { id: "disputes", label: "Disputes", icon: "fa-scale-balanced" },
  { id: "audit", label: "Audit chain", icon: "fa-link" },
];

export default function Ops() {
  const { creds } = useCredentials();
  const [tab, setTab] = useState("lookup");

  return (
    <section className="section-pad">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Ops console</span>
          <h2>Where the operator controls holds and disputes</h2>
          <p>
            Authenticates with the ops bearer token. Every action here is written to the
            tamper-evident audit chain.
          </p>
        </div>

        <div className="ops-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              <i className={"fa-solid " + t.icon} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "lookup" && <Lookup creds={creds} />}
        {tab === "holds" && <Holds creds={creds} />}
        {tab === "disputes" && <Disputes creds={creds} />}
        {tab === "audit" && <Audit creds={creds} />}
      </div>
    </section>
  );
}

function Result({ res }) {
  if (!res) return null;
  return (
    <div className="result">
      <div className="metric">
        <dt>HTTP status</dt>
        <dd className="mono">{res.status}</dd>
      </div>
      <code className="block-kv mt">{JSON.stringify(res.body, null, 2)}</code>
    </div>
  );
}

function opRequest(creds, method, path, payload) {
  return dcsRequest({
    baseUrl: creds.baseUrl,
    method,
    path,
    payload,
    opsToken: creds.opsToken,
  });
}

function Lookup({ creds }) {
  const [txnId, setTxnId] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);

  async function run() {
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      setRes(
        await opRequest(creds, "GET", `/v1/transactions/${txnId.trim()}`)
      );
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3 className="mb">Look up a transaction (tenant-signed GET)</h3>
      <div className="form-grid">
        <div className="field">
          <label>Transaction ID</label>
          <input
            value={txnId}
            onChange={(e) => setTxnId(e.target.value)}
            placeholder="txn_…"
          />
        </div>
      </div>
      <button className="btn mt" onClick={run} disabled={loading}>
        {loading ? <span className="spinner" /> : <i className="fa-solid fa-magnifying-glass" />}
        Look up
      </button>
      {err && <div className="banner banner-danger mt">{err}</div>}
      <Result res={res} />
    </div>
  );
}

function Holds({ creds }) {
  const [holdId, setHoldId] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);

  async function action(kind) {
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      if (kind === "freeze") {
        setRes(await opRequest(creds, "POST", `/v1/holds/${holdId.trim()}/freeze`));
      } else {
        setRes(
          await dcsRequest({
            baseUrl: creds.baseUrl,
            method: "POST",
            path: `/v1/holds/${holdId.trim()}/release`,
            payload: { note: note || "Released from ops console" },
            apiKey: creds.apiKey,
            signingSecret: creds.signingSecret,
          })
        );
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3 className="mb">Freeze or release a hold</h3>
      <p className="muted mb" style={{ fontSize: 14 }}>
        Freeze is an <b>ops</b> action (bearer token) that stops a pending hold so funds stay put
        and the repayment route activates. Release is a tenant-signed action that clears the hold.
        Releasing a <i>frozen</i> hold is blocked until a dispute is resolved.
      </p>
      <div className="form-grid">
        <div className="field">
          <label>Hold ID</label>
          <input value={holdId} onChange={(e) => setHoldId(e.target.value)} placeholder="hold_…" />
        </div>
        <div className="field">
          <label>Note (release only)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button className="btn btn-sm" onClick={() => action("freeze")} disabled={loading || !holdId}>
          {loading ? <span className="spinner" /> : <i className="fa-solid fa-hand" />}
          Freeze (ops)
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => action("release")} disabled={loading || !holdId}>
          Release (signed)
        </button>
      </div>
      {err && <div className="banner banner-danger mt">{err}</div>}
      <Result res={res} />
    </div>
  );
}

function Disputes({ creds }) {
  const [holdId, setHoldId] = useState("");
  const [reason, setReason] = useState("");
  const [disputeId, setDisputeId] = useState("");
  const [outcome, setOutcome] = useState("approved");
  const [note, setNote] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);

  async function fileDispute() {
    setErr(null);
    setRes(null);
    try {
      setRes(
        await dcsRequest({
          baseUrl: creds.baseUrl,
          method: "POST",
          path: "/v1/disputes",
          payload: { hold_id: holdId.trim(), reason: reason.trim() || "Customer did not authorize this transfer." },
          apiKey: creds.apiKey,
          signingSecret: creds.signingSecret,
        })
      );
    } catch (e) {
      setErr(e.message || String(e));
    }
  }

  async function resolveDispute() {
    setErr(null);
    setRes(null);
    try {
      const rid = disputeId.trim();
      setRes(
        await opRequest(creds, "PATCH", `/v1/disputes/${rid}`, {
          outcome,
          note: note.trim() || "Investigation complete (simulated).",
        })
      );
    } catch (e) {
      setErr(e.message || String(e));
    }
  }

  return (
    <div className="card">
      <h3 className="mb">File a dispute (tenant-signed)</h3>
      <p className="muted mb" style={{ fontSize: 14 }}>
        When a transfer is held, the customer can say "I did not authorize this." The dispute
        falls within an investigation SLA; the operator approves (money released back / funds stay)
        or rejects against the evidence.
      </p>
      <div className="form-grid mb">
        <div className="field">
          <label>Hold ID</label>
          <input value={holdId} onChange={(e) => setHoldId(e.target.value)} placeholder="hold_…" />
        </div>
        <div className="field">
          <label>Reason</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this disputed?" />
        </div>
      </div>
      <button className="btn btn-sm" onClick={fileDispute} disabled={!holdId}>
        <i className="fa-solid fa-file-circle-plus" /> File dispute
      </button>

      <div style={{ borderTop: "1px solid var(--border)", margin: "26px 0" }} />

      <h3 className="mb">Resolve a dispute (ops)</h3>
      <div className="form-grid mb">
        <div className="field">
          <label>Dispute ID</label>
          <input value={disputeId} onChange={(e) => setDisputeId(e.target.value)} placeholder="dsp_…" />
        </div>
        <div className="field">
          <label>Outcome</label>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
        </div>
        <div className="field">
          <label>Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
        </div>
      </div>
      <button className="btn btn-sm btn-ghost" onClick={resolveDispute} disabled={!disputeId}>
        <i className="fa-solid fa-gavel" /> Resolve
      </button>

      {err && <div className="banner banner-danger mt">{err}</div>}
      <Result res={res} />
    </div>
  );
}

function Audit({ creds }) {
  const [tenantId, setTenantId] = useState("tenant-test-0001");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);

  async function run() {
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      setRes(await opRequest(creds, "GET", `/v1/audit/verify/${tenantId.trim()}`));
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3 className="mb">Verify the audit chain</h3>
      <p className="muted mb" style={{ fontSize: 14 }}>
        Each audit log entry is hash-chained to the previous entry and signed with a per-tenant
        key. Verifying recomputes the whole chain: any tamper anywhere breaks it.
      </p>
      <div className="form-grid">
        <div className="field">
          <label>Tenant ID</label>
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-sm mt" onClick={run} disabled={loading}>
        {loading ? <span className="spinner" /> : <i className="fa-solid fa-link" />}
        Verify chain
      </button>
      {err && <div className="banner banner-danger mt">{err}</div>}
      <Result res={res} />
    </div>
  );
}