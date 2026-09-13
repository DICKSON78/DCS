import { useCallback, useEffect, useState } from "react";
import { dcsRequest } from "../lib/api.js";
import { useCredentials } from "../lib/credentials.jsx";
import DecisionBadge from "../components/DecisionBadge.jsx";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "fa-gauge-high" },
  { id: "transactions", label: "Transactions", icon: "fa-list" },
  { id: "holds", label: "Holds", icon: "fa-hand" },
  { id: "disputes", label: "Disputes", icon: "fa-scale-balanced" },
  { id: "ledger", label: "Ledger", icon: "fa-book" },
  { id: "audit", label: "Audit chain", icon: "fa-link" },
];

const nf = new Intl.NumberFormat("en-TZ");
const ts = (v) => (v ? new Date(v).toLocaleString("en-TZ", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function Ops() {
  const { creds } = useCredentials();
  const [tab, setTab] = useState("dashboard");

  return (
    <section className="section-pad">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Ops console</span>
          <h2>Admin panel ya waendeshaji — kila kitu cha shughuli za ukaguzi</h2>
          <p>
            Data halisi kutoka kwenye hifadhidata (sio sandbox): kagua transactions, holds, disputes na
            ledegar, na fanya uamuzi moja kwa moja. Kila kitendo kinaandikwa kwenye audit chain isiyoweza
            kubadilishwa.
          </p>
        </div>

        <div className="ops-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              <i className={"fa-solid " + t.icon} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && <Dashboard creds={creds} />}
        {tab === "transactions" && <Transactions creds={creds} />}
        {tab === "holds" && <Holds creds={creds} />}
        {tab === "disputes" && <Disputes creds={creds} />}
        {tab === "ledger" && <Ledger creds={creds} />}
        {tab === "audit" && <Audit creds={creds} />}
      </div>
    </section>
  );
}

function opRequest(creds, method, path, payload) {
  return dcsRequest({ baseUrl: creds.baseUrl, method, path, payload, opsToken: creds.opsToken });
}

function useOpsData(creds, path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await opRequest(creds, "GET", path);
      if (res.status !== 200) throw new Error(res.body?.message || "HTTP " + res.status);
      setData(res.body);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [creds.baseUrl, creds.opsToken, path]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  return { data, loading, error, reload: load };
}

function State({ loading, error, empty, emptyText }) {
  if (loading) return <p className="muted" style={{ padding: "18px 0" }}><span className="spinner" /> Inapakia…</p>;
  if (error) return <div className="banner banner-danger mt">{error}</div>;
  if (empty) return <p className="muted" style={{ padding: "18px 0" }}>{emptyText || "Hakuna data."}</p>;
  return null;
}

function Dashboard({ creds }) {
  const { data, loading, error, reload } = useOpsData(creds, "/v1/ops/dashboard");

  if (loading || error || !data) return <State loading={loading} error={error} />;

  const t = data.totals;
  const total = Object.values(data.decisions).reduce((a, b) => a + b, 0) || t.transactions;
  const cards = [
    { label: "Transactions zote", value: t.transactions, icon: "fa-list", blue: true },
    { label: "Fedha zilizohamishwa (TZS)", value: nf.format(t.cash_moved_tzs), icon: "fa-money-bill-transfer" },
    { label: "Escrow (holds)", value: nf.format(t.escrow_balance_tzs), icon: "fa-vault" },
    { label: "Holds zilizofunguliwa", value: t.active_holds, icon: "fa-hand" },
    { label: "Disputes wazi", value: t.open_disputes, icon: "fa-scale-balanced" },
    { label: "Maingizo ya ledger", value: t.ledger_entries, icon: "fa-book", blue: true },
  ];
  const order = ["allow", "warn", "hold", "block"];
  const colors = { allow: "#34d399", warn: "#fbbf24", hold: "#fb923c", block: "#f87171" };

  return (
    <>
      <div className="grid grid-3" style={{ marginBottom: 22 }}>
        {cards.map((c) => (
          <div className="card" key={c.label}>
            <h3 style={{ fontSize: 15 }}><i className={"fa-solid " + c.icon} /> {c.label}</h3>
            <p style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: c.blue ? "#7dd3fc" : "#e2e8f0" }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <h3 style={{ fontSize: 16 }}>Mgawanyo wa maamuzi (decision split)</h3>
        <div style={{ display: "flex", gap: 28, marginTop: 10, flexWrap: "wrap" }}>
          {order.map((d) => {
            const n = data.decisions[d] || 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <div key={d} style={{ minWidth: 90 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <DecisionBadge decision={d} />
                  <b>{n}</b>
                </div>
                <div style={{ background: "#1e293b", borderRadius: 8, height: 8, marginTop: 6, width: "100%" }}>
                  <div style={{ background: colors[d], height: 8, borderRadius: 8, width: pct + "%" }} />
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{pct}% · {nf.format(n)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>Shughuli za hivi karibuni</h3>
          <button className="btn btn-sm" onClick={reload}><i className="fa-solid fa-rotate" /> Refresh</button>
        </div>
        <TxTable rows={data.recent} />
      </div>
    </>
  );
}

function TxTable({ rows }) {
  if (!rows?.length) return <p className="muted" style={{ padding: "14px 0" }}>Hakuna transactions.</p>;
  return (
    <div className="doc-table-wrap" style={{ marginTop: 12 }}>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Saa</th>
            <th>Mupelekaji</th>
            <th>Mpokeaji</th>
            <th>Kiasi</th>
            <th>Decision</th>
            <th>Score</th>
            <th>Hold</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.transaction_id}>
              <td>
                <span className="mono">{ts(r.created_at)}</span>
                <div className="muted" style={{ fontSize: 11 }}>{r.tenant_id}</div>
              </td>
              <td className="mono">{r.user_external_ref}</td>
              <td className="mono">{r.recipient_external_ref}</td>
              <td>{nf.format(r.amount)}</td>
              <td><DecisionBadge decision={r.decision} /></td>
              <td className="mono">{r.risk_score != null ? r.risk_score.toFixed(1) : "—"}</td>
              <td className="muted">{r.hold_status || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Transactions({ creds }) {
  const [decision, setDecision] = useState("");
  const { data, loading, error, reload } = useOpsData(
    creds,
    "/v1/ops/transactions" + (decision ? "?decision=" + decision : ""),
    [decision]
  );
  const rows = data?.transactions || [];

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Transactions zote ({data?.total ?? "…"})</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="">Decision — zote</option>
            <option value="allow">allow</option>
            <option value="warn">warn</option>
            <option value="hold">hold</option>
            <option value="block">block</option>
          </select>
          <button className="btn btn-sm" onClick={reload}><i className="fa-solid fa-rotate" /></button>
        </div>
      </div>
      <State loading={loading} error={error} />
      {!loading && !error && <TxTable rows={rows} />}
    </div>
  );
}

function Holds({ creds }) {
  const { data, loading, error, reload } = useOpsData(creds, "/v1/ops/holds");
  const [busy, setBusy] = useState("");

  async function act(h, kind) {
    setBusy(h.hold_id + ":" + kind);
    try {
      if (kind === "freeze") {
        await opRequest(creds, "POST", "/v1/holds/" + h.hold_id + "/freeze");
      } else {
        await dcsRequest({
          baseUrl: creds.baseUrl,
          method: "POST",
          path: "/v1/holds/" + h.hold_id + "/release",
          payload: { released_by: "ops-console", note: "Released from admin panel" },
          apiKey: creds.apiKey,
          signingSecret: creds.signingSecret,
        });
      }
      await reload();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Holds</h3>
        <button className="btn btn-sm" onClick={reload}><i className="fa-solid fa-rotate" /></button>
      </div>
      <State loading={loading} error={error} />
      {!loading && !error && (
        <div className="doc-table-wrap" style={{ marginTop: 12 }}>
          <table className="doc-table">
            <thead>
              <tr><th>Hold ID</th><th>Mtumaji</th><th>Mpokeaji</th><th>Kiasi</th><th>Juu ya score</th><th>Status</th><th>Saa</th><th>Kitendo</th></tr>
            </thead>
            <tbody>
              {(data?.holds || []).map((h) => (
                <tr key={h.hold_id}>
                  <td className="mono" style={{ fontSize: 12 }}>{h.hold_id.slice(0, 8)}</td>
                  <td className="mono">{h.transaction.recipient_ref}</td>
                  <td className="mono">{h.transaction.sender_ref}</td>
                  <td>{nf.format(h.transaction.amount)}</td>
                  <td className="mono">{h.transaction.risk_score?.toFixed(1)}</td>
                  <td>
                    <span className={"badge " + (h.status === "active" ? "badge-hold" : h.status === "frozen" ? "badge-block" : "badge-allow")} style={{ textTransform: "uppercase" }}>{h.status}</span>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{ts(h.created_at)}</td>
                  <td>
                    {h.status === "active" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" disabled={busy === h.hold_id + ":freeze"} onClick={() => act(h, "freeze")}>Freeze</button>
                        <button className="btn btn-sm btn-ghost" disabled={busy === h.hold_id + ":release"} onClick={() => act(h, "release")}>Release</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Disputes({ creds }) {
  const { data, loading, error, reload } = useOpsData(creds, "/v1/ops/disputes");
  const [busy, setBusy] = useState("");

  async function resolve(d, outcome) {
    setBusy(d.dispute_id + ":" + outcome);
    try {
      await opRequest(creds, "PATCH", "/v1/disputes/" + d.dispute_id, {
        outcome,
        note: outcome === "approved" ? "Ulaghai umethibitishwa — rejesha fedha." : "Hakuna ushahidi wa ulaghai.",
      });
      await reload();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Disputes</h3>
          <button className="btn btn-sm" onClick={reload}><i className="fa-solid fa-rotate" /></button>
        </div>
        <State loading={loading} error={error} />
        {!loading && !error && (
          <div className="doc-table-wrap" style={{ marginTop: 12 }}>
            <table className="doc-table">
              <thead>
                <tr><th>Dispute ID</th><th>Kiasi</th><th>Status</th><th>Outcome</th><th>SLA ifike</th><th>Sababu</th><th>Kitendo</th></tr>
              </thead>
              <tbody>
                {(data?.disputes || []).map((d) => (
                  <tr key={d.dispute_id}>
                    <td className="mono" style={{ fontSize: 12 }}>{d.dispute_id.slice(0, 8)}</td>
                    <td>{nf.format(d.transaction.amount)}</td>
                    <td>
                      <span className={"badge " + (d.status === "open" ? "badge-hold" : d.outcome === "approved" ? "badge-allow" : "badge-block")} style={{ textTransform: "uppercase" }}>{d.status}</span>
                    </td>
                    <td className="muted">{d.outcome || "—"}</td>
                    <td><span className="mono" style={{ fontSize: 12 }}>{ts(d.sla_due_at)}</span></td>
                    <td style={{ maxWidth: 220, fontSize: 12 }}>{d.reason}</td>
                    <td>
                      {d.status === "open" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-sm" disabled={busy === d.dispute_id + ":approved"} onClick={() => resolve(d, "approved")}>Refund (approved)</button>
                          <button className="btn btn-sm btn-ghost" disabled={busy === d.dispute_id + ":rejected"} onClick={() => resolve(d, "rejected")}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Ledger({ creds }) {
  const { data, loading, error, reload } = useOpsData(creds, "/v1/ops/ledger?entries=40");

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Ledger — akaunti na mwendo wa kila fedha</h3>
        <button className="btn btn-sm" onClick={reload}><i className="fa-solid fa-rotate" /></button>
      </div>
      <State loading={loading} error={error} />
      {!loading && !error && (
        <>
          <div className="doc-table-wrap" style={{ marginTop: 12 }}>
            <table className="doc-table">
              <thead><tr><th>Akaunti</th><th>Aina</th><th>Jina</th><th>Salio (TZS)</th></tr></thead>
              <tbody>
                {(data?.accounts || []).map((a) => (
                  <tr key={a.external_ref}>
                    <td className="mono">{a.external_ref}</td>
                    <td><span className={"badge " + (a.kind === "escrow" ? "badge-hold" : a.kind === "sender" ? "badge-allow" : "badge-neutral")} style={{ textTransform: "uppercase" }}>{a.kind}</span></td>
                    <td>{a.name || "—"}</td>
                    <td><b style={{ color: a.balance < 0 ? "#f87171" : "#86efac" }}>{nf.format(a.balance)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 style={{ marginTop: 20 }}>Mwendo wa hivi karibuni (double-entry)</h4>
          <div className="doc-table-wrap" style={{ marginTop: 8 }}>
            <table className="doc-table">
              <thead><tr><th>Saa</th><th>Ref</th><th>Kutoka</th><th>→ Kwenda</th><th>Kiasi</th><th>Aina</th></tr></thead>
              <tbody>
                {(data?.entries || []).map((e, i) => (
                  <tr key={e.reference + "-" + i}>
                    <td className="mono" style={{ fontSize: 11 }}>{ts(e.created_at)}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{e.reference.slice(0, 8)}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{e.from_ref}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{e.to_ref}</td>
                    <td>{nf.format(e.amount)}</td>
                    <td><span className="muted" style={{ textTransform: "uppercase", fontSize: 11 }}>{e.kind} · {e.direction}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
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
        Kila ingizo la audit limeunganishwa kwenye lile lililotangulia kwa hash chain na kutiwa saini kwa
        ufunguo wa tenant. Kuthibitisha kunarejesha mnyororo mzima — kitendo chochote cha kughushi humvunja.
      </p>
      <div className="form-grid">
        <div className="field">
          <label>Tenant ID</label>
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-sm mt" onClick={run} disabled={loading}>
        {loading ? <span className="spinner" /> : <i className="fa-solid fa-link" />} Verify chain
      </button>
      {err && <div className="banner banner-danger mt">{err}</div>}
      {res && (
        <div className="result">
          <div className="metric"><dt>HTTP status</dt><dd className="mono">{res.status}</dd></div>
          <code className="block-kv mt">{JSON.stringify(res.body, null, 2)}</code>
        </div>
      )}
    </div>
  );
}