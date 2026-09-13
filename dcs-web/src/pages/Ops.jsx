import { useEffect, useState } from "react";
import { dcsRequest } from "../lib/api.js";
import { useCredentials } from "../lib/credentials.jsx";
import "../styles/ops.css";

const NAV = [
  { group: "Overview", items: [
    { id: "dashboard", label: "Dashboard", icon: "fa-gauge-high" },
    { id: "transactions", label: "Transactions", icon: "fa-arrow-right-arrow-left" },
  ]},
  { group: "Risk control", items: [
    { id: "holds", label: "Holds", icon: "fa-hand" },
    { id: "disputes", label: "Disputes", icon: "fa-scale-balanced" },
  ]},
  { group: "Ledger", items: [
    { id: "ledger", label: "Ledger", icon: "fa-book" },
    { id: "audit", label: "Audit chain", icon: "fa-link" },
  ]},
  { group: "Sandbox", items: [
    { id: "directory", label: "Directory", icon: "fa-address-book" },
  ]},
];

const nf = new Intl.NumberFormat("en-TZ");
const sz = new Intl.NumberFormat("en-TZ", { notation: "compact", maximumFractionDigits: 1 });
const ts = (v) => (v ? new Date(v).toLocaleString("en-TZ", { dateStyle: "short", timeStyle: "short" }) : "—");

const STATUS = (d, hold) => {
  if (d === "block") return { label: "Fraud blocked", cls: "warn" };
  if (d === "hold") return { label: hold === "active" ? "Held" : hold === "frozen" ? "Frozen" : "Released", cls: hold === "released" ? "ghost" : "warn" };
  if (d === "warn") return { label: "Flagged", cls: "ghost" };
  return { label: "Settled", cls: "ok" };
};
const CHANNEL_ICON = { mobile_money: "fa-mobile-screen", bank: "fa-building-columns", internet: "fa-globe", ussd: "fa-hashtag", pos: "fa-credit-card", qr: "fa-qrcode" };

export default function Ops() {
  const { creds } = useCredentials();
  const [tab, setTab] = useState("dashboard");
  const [q, setQ] = useState("");

  return (
    <div className="ops-app">
      <aside className="ops-sidebar">
        <div className="ops-brand">
          <span className="b-mark">D</span>
          <div><em>DCS <b>Secure</b></em><small>Admin panel</small></div>
        </div>
        {NAV.map((g) => (
          <div className="ops-group" key={g.group}>
            <p className="ops-label">{g.group}</p>
            {g.items.map((it) => (
              <button key={it.id} className={"ops-link" + (tab === it.id ? " active" : "")} onClick={() => setTab(it.id)}>
                <i className={"fa-solid " + it.icon} /><span>{it.label}</span>
              </button>
            ))}
          </div>
        ))}
        <div className="ops-user">
          <span className="ops-avatar">DS</span>
          <div><b>Operator</b><span>ops-console@dcs.dev</span></div>
        </div>
      </aside>

      <main className="ops-main">
        <div className="ops-top">
          <div>
            <h1>{NAV.flatMap((g) => g.items).find((i) => i.id === tab)?.label || "Dashboard"}</h1>
            <p className="ops-bread">Ops console <span>/</span> {NAV.flatMap((g) => g.items).find((i) => i.id === tab)?.label || "Dashboard"}</p>
          </div>
          <div className="ops-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input type="search" placeholder="Search refs, amounts, decisions..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="ops-icons">
            <button className="ops-icon" title="Requests authenticated with the ops token"><i className="fa-solid fa-key" /></button>
            <span className="ops-avatar">DS</span>
          </div>
        </div>

        {tab === "dashboard" && <Dashboard creds={creds} q={q} onNav={setTab} />}
        {tab === "transactions" && <Transactions creds={creds} q={q} />}
        {tab === "holds" && <Holds creds={creds} />}
        {tab === "disputes" && <Disputes creds={creds} />}
        {tab === "ledger" && <Ledger creds={creds} />}
        {tab === "audit" && <Audit creds={creds} />}
        {tab === "directory" && <Directory creds={creds} />}
      </main>
    </div>
  );
}

function opRequest(creds, method, path, payload) {
  return dcsRequest({ baseUrl: creds.baseUrl, method, path, payload, opsToken: creds.opsToken });
}

function useOpsData(creds, path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await opRequest(creds, "GET", path);
      if (res.status !== 200) throw new Error(res.body?.message || "HTTP " + res.status);
      setData(res.body);
    } catch (e) { setError(e.message || String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creds.baseUrl, creds.opsToken, path]);
  return { data, loading, error, reload: load };
}

function State({ loading, error, empty, emptyText }) {
  if (loading) return <p className="ops-note"><span className="ops-spin" />Loading...</p>;
  if (error) return <div className="ops-err">{error}</div>;
  if (empty) return <p className="ops-note">{emptyText || "No data."}</p>;
  return null;
}

function filterRows(rows, q) {
  if (!q) return rows;
  const s = q.toLowerCase();
  return rows.filter((r) => JSON.stringify([r.user_external_ref, r.recipient_external_ref, r.recipient_ref, r.transaction_id, r.decision, r.amount]).toLowerCase().includes(s));
}

function TxTable({ rows, q }) {
  const list = filterRows(rows, q);
  if (!list.length) return <p className="ops-note">No matching transactions.</p>;
  return (
    <table className="ops-table">
      <thead>
        <tr><th>Reference</th><th>Rail</th><th>Amount</th><th>Status</th><th>Time</th></tr>
      </thead>
      <tbody>
        {list.map((r) => {
          const st = STATUS(r.decision, r.hold_status);
          const icon = CHANNEL_ICON[r.channel] || "fa-globe";
          return (
            <tr key={r.transaction_id}>
              <td><span className="ops-id">{r.transaction_id.slice(0, 10)}</span><div className="ops-sub">{r.tenant_id}</div></td>
              <td><span className="ops-rail"><i className={"fa-solid " + icon} />{r.user_external_ref.slice(-6)} → {r.recipient_external_ref.slice(-6)}</span></td>
              <td><span className="ops-amt">{nf.format(r.amount)}<small>TZS → TZS</small></span></td>
              <td><span className={"ops-badge " + st.cls}>{st.label}</span></td>
              <td className="ops-mono">{ts(r.created_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ---------------- DASHBOARD ---------------- */
function Dashboard({ creds, q, onNav }) {
  const { data, loading, error, reload } = useOpsData(creds, "/v1/ops/dashboard");
  if (loading || error || !data) return <State loading={loading} error={error} />;

  const { totals: t, decisions, volume_7d } = data;
  const maxDay = Math.max(1, ...(volume_7d || []).map((d) => d.count));
  const stats = [
    { label: "Total transactions", val: nf.format(t.transactions), icon: "fa-arrow-right-arrow-left", trend: "+" + (decisions.allow || 0) + " allowed" },
    { label: "Cash moved", val: nf.format(t.cash_moved_tzs), icon: "fa-coins", trend: sz.format(t.cash_moved_tzs) + " TZS" },
    { label: "Escrow balance", val: nf.format(t.escrow_balance_tzs), icon: "fa-vault", trend: t.active_holds + " active holds" },
    { label: "Open disputes", val: nf.format(t.open_disputes), icon: "fa-scale-balanced", trend: t.ledger_entries + " ledger entries", warn: t.open_disputes > 0 },
  ];

  return (
    <>
      <div className="ops-stat-grid">
        {stats.map((s) => (
          <div className="ops-stat" key={s.label}>
            <div className="top">
              <span className="ic"><i className={"fa-solid " + s.icon} /></span>
              <span className={"trend" + (s.warn ? " warn" : "")}>{s.trend}</span>
            </div>
            <b>{s.val}</b>
            <p className="lbl">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="ops-grid2">
        <div className="ops-panel">
          <div className="ops-panel-head">
            <div><h3>Transaction volume</h3><p className="sub">Last 7 days · number of transactions</p></div>
            <a onClick={() => onNav("transactions")}>View transactions</a>
          </div>
          <div className="ops-chart">
            {(volume_7d || []).map((d) => {
              const day = new Date(d.date + "T00:00:00").toLocaleDateString("en-TZ", { weekday: "short" });
              const pct = Math.max(3, Math.round((d.count / maxDay) * 100));
              return (
                <div className="bar" key={d.date}>
                  <em>{d.count}</em>
                  <i style={{ height: pct + "%" }} />
                  <span>{day}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-panel-head">
            <div><h3>Ledger snapshot</h3><p className="sub">double-entry · escrow · holds</p></div>
            <a onClick={() => onNav("ledger")}>Ledger</a>
          </div>
          <div className="ops-kitem"><span className="ki"><i className="fa-solid fa-vault" /></span><div><b>Escrow (holds)</b><span>Funds held in escrow</span></div><span className="val ops-mono">{nf.format(t.escrow_balance_tzs)}</span></div>
          <div className="ops-kitem"><span className="ki"><i className="fa-solid fa-coins" /></span><div><b>Cash moved</b><span>transfer · credit</span></div><span className="val ops-mono">{nf.format(t.cash_moved_tzs)}</span></div>
          <div className="ops-kitem"><span className="ki"><i className="fa-solid fa-book" /></span><div><b>Ledger entries</b><span>debit + credit</span></div><span className="val ops-mono">{nf.format(t.ledger_entries)}</span></div>
          <div className="ops-kitem"><span className="ki"><i className="fa-solid fa-hand" /></span><div><b>Active holds</b><span>awaiting a decision</span></div><span className="val ops-mono">{nf.format(t.active_holds)}</span></div>
          <div className="ops-kitem"><span className="ki"><i className="fa-solid fa-scale-balanced" /></span><div><b>Open disputes</b><span>investigation SLA</span></div><span className="val ops-mono">{nf.format(t.open_disputes)}</span></div>
        </div>
      </div>

      <div className="ops-panel">
        <div className="ops-panel-head">
          <div><h3>Recent transactions</h3><p className="sub">Latest activity across all rails</p></div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="ops-btn ghost" onClick={reload}><i className="fa-solid fa-rotate-right" /></button>
            <a onClick={() => onNav("transactions")}>View all</a>
          </div>
        </div>
        <TxTable rows={data.recent} q={q} />
      </div>
    </>
  );
}

/* ---------------- TRANSACTIONS ---------------- */
function Transactions({ creds, q }) {
  const [decision, setDecision] = useState("");
  const { data, loading, error, reload } = useOpsData(creds, "/v1/ops/transactions" + (decision ? "?decision=" + decision : ""));
  return (
    <div className="ops-panel">
      <div className="ops-panel-head">
        <div><h3>All transactions {data?.total != null && `(${data.total})`}</h3><p className="sub">Real transactions in the system</p></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select className="ops-select" value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="">Decision — all</option>
            <option value="allow">allow</option><option value="warn">warn</option>
            <option value="hold">hold</option><option value="block">block</option>
          </select>
          <button className="ops-btn ghost" onClick={reload}><i className="fa-solid fa-rotate-right" /></button>
        </div>
      </div>
      <State loading={loading} error={error} />
      {data && !loading && !error && <TxTable rows={data.transactions} q={q} />}
    </div>
  );
}

/* ---------------- HOLDS ---------------- */
function Holds({ creds }) {
  const { data, loading, error, reload } = useOpsData(creds, "/v1/ops/holds");
  const [busy, setBusy] = useState("");
  async function act(h, kind) {
    setBusy(h.hold_id + ":" + kind);
    try {
      if (kind === "freeze") await opRequest(creds, "POST", "/v1/holds/" + h.hold_id + "/freeze");
      else if (kind === "cancel") await opRequest(creds, "DELETE", "/v1/holds/" + h.hold_id);
      else await dcsRequest({ baseUrl: creds.baseUrl, method: "POST", path: "/v1/holds/" + h.hold_id + "/release", payload: { released_by: "ops-console", note: "Admin panel" }, apiKey: creds.apiKey, signingSecret: creds.signingSecret });
      await reload();
    } catch (e) { alert(e.message || String(e)); }
    finally { setBusy(""); }
  }
  const st = (s) => s === "active" ? <span className="ops-badge">Active</span> : s === "frozen" ? <span className="ops-badge warn">Frozen</span> : <span className="ops-badge ok">Released</span>;
  return (
    <div className="ops-panel">
      <div className="ops-panel-head">
        <div><h3>Holds</h3><p className="sub">Funds held awaiting a decision</p></div>
        <button className="ops-btn ghost" onClick={reload}><i className="fa-solid fa-rotate-right" /></button>
      </div>
      <State loading={loading} error={error} />
      {!loading && !error && (
        <table className="ops-table">
          <thead><tr><th>Hold ID</th><th>Flow</th><th>Amount</th><th>Score</th><th>Status</th><th>Time</th><th>Action</th></tr></thead>
          <tbody>
            {(data?.holds || []).map((h) => (
              <tr key={h.hold_id}>
                <td className="ops-id">{h.hold_id.slice(0, 8)}</td>
                <td><span className="ops-who">{h.transaction.sender_ref} → {h.transaction.recipient_ref}</span></td>
                <td><span className="ops-amt">{nf.format(h.transaction.amount)}</span></td>
                <td className="ops-mono">{h.transaction.risk_score?.toFixed(1)}</td>
                <td>{st(h.status)}</td>
                <td className="ops-mono">{ts(h.created_at)}</td>
                <td>
                  {h.status === "active" && (
                    <div className="ops-acts">
                      <button className="ops-btn ghost" disabled={!!busy} onClick={() => act(h, "freeze")}><i className="fa-solid fa-lock" />Freeze</button>
                      <button className="ops-btn" disabled={!!busy} onClick={() => act(h, "release")}><i className="fa-solid fa-check" />Release</button>
                      <button className="ops-btn danger" disabled={!!busy} onClick={() => act(h, "cancel")}><i className="fa-solid fa-ban" />Cancel</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------- DISPUTES ---------------- */
function Disputes({ creds }) {
  const { data, loading, error, reload } = useOpsData(creds, "/v1/ops/disputes");
  const [busy, setBusy] = useState("");
  async function resolve(d, outcome) {
    setBusy(d.dispute_id + ":" + outcome);
    try {
      await opRequest(creds, "PATCH", "/v1/disputes/" + d.dispute_id, { outcome, note: outcome === "approved" ? "Fraud confirmed — refund the sender." : "No evidence of fraud." });
      await reload();
    } catch (e) { alert(e.message || String(e)); }
    finally { setBusy(""); }
  }
  async function withdraw(d) {
    setBusy(d.dispute_id + ":withdraw");
    try {
      await opRequest(creds, "DELETE", "/v1/disputes/" + d.dispute_id);
      await reload();
    } catch (e) { alert(e.message || String(e)); }
    finally { setBusy(""); }
  }
  const st = (d) => d.status === "open" ? <span className="ops-badge">Open</span> : d.outcome === "approved" ? <span className="ops-badge ok">Refunded</span> : <span className="ops-badge ghost">Rejected</span>;
  return (
    <div className="ops-panel">
      <div className="ops-panel-head">
        <div><h3>Disputes</h3><p className="sub">Fraud reports — investigation SLA 48h</p></div>
        <button className="ops-btn ghost" onClick={reload}><i className="fa-solid fa-rotate-right" /></button>
      </div>
      <State loading={loading} error={error} />
      {!loading && !error && (
        <table className="ops-table">
          <thead><tr><th>Dispute ID</th><th>Amount</th><th>Status</th><th>SLA due</th><th>Reason</th><th>Action</th></tr></thead>
          <tbody>
            {(data?.disputes || []).map((d) => (
              <tr key={d.dispute_id}>
                <td className="ops-id">{d.dispute_id.slice(0, 8)}</td>
                <td><span className="ops-amt">{nf.format(d.transaction.amount)}</span><div className="ops-sub">{d.transaction.sender_ref} → {d.transaction.recipient_ref}</div></td>
                <td>{st(d)}</td>
                <td className="ops-mono">{ts(d.sla_due_at)}</td>
                <td style={{ maxWidth: 240, fontSize: 12.5 }}>{d.reason}</td>
                <td>
                  {d.status === "open" && (
                    <div className="ops-acts">
                      <button className="ops-btn" disabled={!!busy} onClick={() => resolve(d, "approved")}><i className="fa-solid fa-rotate-left" />Refund</button>
                      <button className="ops-btn ghost" disabled={!!busy} onClick={() => resolve(d, "rejected")}><i className="fa-solid fa-xmark" />Reject</button>
                      <button className="ops-btn danger" disabled={!!busy} onClick={() => withdraw(d)}><i className="fa-solid fa-arrow-right-from-bracket" />Withdraw</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------- LEDGER ---------------- */
function Ledger({ creds }) {
  const { data, loading, error, reload } = useOpsData(creds, "/v1/ops/ledger?entries=30");
  return (
    <>
      <div className="ops-panel">
        <div className="ops-panel-head">
          <div><h3>Ledger accounts</h3><p className="sub">Real balance for every wallet</p></div>
          <button className="ops-btn ghost" onClick={reload}><i className="fa-solid fa-rotate-right" /></button>
        </div>
        <State loading={loading} error={error} />
        {!loading && !error && (
          <table className="ops-table">
            <thead><tr><th>Account</th><th>Kind</th><th>Name</th><th>Balance (TZS)</th></tr></thead>
            <tbody>
              {(data?.accounts || []).map((a) => (
                <tr key={a.external_ref}>
                  <td className="ops-mono">{a.external_ref}</td>
                  <td><span className={"ops-badge " + (a.kind === "escrow" ? "" : a.kind === "sender" ? "ok" : "ghost")}>{a.kind}</span></td>
                  <td className="ops-who">{a.name || "—"}</td>
                  <td><b className="ops-mono">{nf.format(a.balance)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="ops-panel">
        <div className="ops-panel-head">
          <div><h3>Recent movements</h3><p className="sub">Double-entry movements</p></div>
        </div>
        {!loading && !error && (
          <table className="ops-table">
            <thead><tr><th>Time</th><th>Ref</th><th>From</th><th>→ To</th><th>Amount</th><th>Kind</th></tr></thead>
            <tbody>
              {(data?.entries || []).map((e, i) => (
                <tr key={e.reference + "-" + i}>
                  <td className="ops-mono">{ts(e.created_at)}</td>
                  <td className="ops-id">{e.reference.slice(0, 8)}</td>
                  <td className="ops-mono">{e.from_ref}</td>
                  <td className="ops-mono">{e.to_ref}</td>
                  <td className="ops-amt">{nf.format(e.amount)}</td>
                  <td><span className="ops-sub">{e.kind} · {e.direction}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ---------------- DIRECTORY ---------------- */
function Directory({ creds }) {
  const cust = useOpsData(creds, "/v1/sandbox/customers");
  const scen = useOpsData(creds, "/v1/sandbox/scenarios");
  const [editC, setEditC] = useState(null);
  const [editS, setEditS] = useState(null);
  const [saving, setSaving] = useState(false);

  async function saveCustomer(p) {
    setSaving(true);
    try {
      if (editC) {
        const { kind, ...rest } = p;
        const res = await opRequest(creds, "PATCH", "/v1/sandbox/customers/" + editC.external_ref, rest);
        if (res.status !== 200) throw new Error(res.body?.message || "HTTP " + res.status);
      } else {
        const res = await opRequest(creds, "POST", "/v1/sandbox/customers", p);
        if (res.status !== 201) throw new Error(res.body?.message || "HTTP " + res.status);
      }
      setEditC(null); await cust.reload();
    } catch (e) { alert(e.message || String(e)); }
    finally { setSaving(false); }
  }
  async function delCustomer(c) {
    if (!confirm("Delete " + c.external_ref + "? Blocked unless its ledger balance is zero.")) return;
    const res = await opRequest(creds, "DELETE", "/v1/sandbox/customers/" + c.external_ref);
    if (res.status !== 200) { alert(res.body?.message || "HTTP " + res.status); return; }
    await cust.reload();
  }
  async function saveScenario(p) {
    setSaving(true);
    try {
      if (editS) {
        const res = await opRequest(creds, "PATCH", "/v1/sandbox/scenarios/" + editS.key, p);
        if (res.status !== 200) throw new Error(res.body?.message || "HTTP " + res.status);
      } else {
        const res = await opRequest(creds, "POST", "/v1/sandbox/scenarios", p);
        if (res.status !== 201) throw new Error(res.body?.message || "HTTP " + res.status);
      }
      setEditS(null); await scen.reload();
    } catch (e) { alert(e.message || String(e)); }
    finally { setSaving(false); }
  }
  async function delScenario(s) {
    if (!confirm("Delete scenario " + s.key + "?")) return;
    const res = await opRequest(creds, "DELETE", "/v1/sandbox/scenarios/" + s.key);
    if (res.status !== 200) { alert(res.body?.message || "HTTP " + res.status); return; }
    await scen.reload();
  }

  const customers = [
    ...(cust.data?.senders || []),
    ...(cust.data?.recipients || []),
  ];

  return (
    <>
      <div className="ops-panel">
        <div className="ops-panel-head">
          <div><h3>Customer directory</h3><p className="sub">Sandbox senders &amp; recipients — create, edit or delete (creates/deletes the matching ledger account)</p></div>
          {!editC && <button className="ops-btn" onClick={() => setEditC({})}><i className="fa-solid fa-plus" />New customer</button>}
        </div>
        {editC && <CustomerForm initial={editC.external_ref ? editC : null} saving={saving} onSave={saveCustomer} onCancel={() => setEditC(null)} />}
        <State loading={cust.loading} error={cust.error} />
        {cust.data && !cust.loading && !cust.error && (
          <table className="ops-table">
            <thead><tr><th>Ref</th><th>Name</th><th>Kind</th><th>Age</th><th>Balance (TZS)</th><th>Action</th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.external_ref}>
                  <td className="ops-mono">{c.external_ref}</td>
                  <td className="ops-who">{c.registered_name}<div className="ops-sub">{c.display_name || "—"}</div></td>
                  <td><span className={"ops-badge " + (c.kind === "sender" ? "ok" : c.kind === "recipient" ? "ghost" : "")}>{c.kind}</span></td>
                  <td className="ops-mono">{c.account_age_days}d</td>
                  <td><b className="ops-mono">{nf.format(c.balance)}</b></td>
                  <td>
                    <div className="ops-acts">
                      <button className="ops-btn ghost" onClick={() => setEditC(c)}><i className="fa-solid fa-pen" />Edit</button>
                      <button className="ops-btn danger" onClick={() => delCustomer(c)}><i className="fa-solid fa-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="ops-panel">
        <div className="ops-panel-head">
          <div><h3>Demo scenarios</h3><p className="sub">Presets shown in the simulator — expected decision, flow, parties, amount</p></div>
          {!editS && <button className="ops-btn" onClick={() => setEditS({})}><i className="fa-solid fa-plus" />New scenario</button>}
        </div>
        {editS && <ScenarioForm initial={editS.key ? editS : null} saving={saving} onSave={saveScenario} onCancel={() => setEditS(null)} />}
        <State loading={scen.loading} error={scen.error} />
        {scen.data && !scen.loading && !scen.error && (
          <table className="ops-table">
            <thead><tr><th>Key</th><th>Title</th><th>Expected</th><th>Flow</th><th>Parties</th><th>Amount</th><th>Action</th></tr></thead>
            <tbody>
              {(scen.data.scenarios || []).map((s) => (
                <tr key={s.key}>
                  <td className="ops-mono">{s.key}</td>
                  <td className="ops-who">{s.title}<div className="ops-sub">{s.tag}</div></td>
                  <td><span className={"ops-badge " + (s.expected_decision === "allow" ? "ok" : s.expected_decision === "block" ? "warn" : "ghost")}>{s.expected_decision}</span></td>
                  <td className="ops-mono">{s.flow}</td>
                  <td className="ops-mono">{s.preset?.sender} → {s.preset?.recipient}</td>
                  <td className="ops-amt">{s.preset?.amount != null ? nf.format(s.preset.amount) : "—"}</td>
                  <td>
                    <div className="ops-acts">
                      <button className="ops-btn ghost" onClick={() => setEditS(s)}><i className="fa-solid fa-pen" />Edit</button>
                      <button className="ops-btn danger" onClick={() => delScenario(s)}><i className="fa-solid fa-trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Field({ label, children }) {
  return <label className="ops-field"><span>{label}</span>{children}</label>;
}

function CustomerForm({ initial, saving, onSave, onCancel }) {
  const [f, setF] = useState({
    kind: initial?.kind || "sender",
    external_ref: initial?.external_ref || "",
    registered_name: initial?.registered_name || "",
    account_age_days: initial?.account_age_days ?? 180,
    balance: initial?.balance ?? 0,
  });
  const set = (k) => (e) => {
    const v = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setF({ ...f, [k]: v });
  };
  return (
    <div className="ops-form">
      <div className="ops-form-row">
        {initial && (
          <Field label="Kind"><input className="ops-select" value={f.kind} disabled /></Field>
        )}
        {!initial && (
          <Field label="Kind">
            <select className="ops-select" value={f.kind} onChange={set("kind")}>
              <option value="sender">sender</option><option value="recipient">recipient</option>
            </select>
          </Field>
        )}
        <Field label="External ref"><input className="ops-select" placeholder="2557…" value={f.external_ref} onChange={set("external_ref")} disabled={!!initial} /></Field>
        <Field label="Registered name"><input className="ops-select" value={f.registered_name} onChange={set("registered_name")} /></Field>
        <Field label="Account age (days)"><input className="ops-select" type="number" min={0} value={f.account_age_days} onChange={set("account_age_days")} /></Field>
        <Field label="Opening balance (TZS)"><input className="ops-select" type="number" min={0} value={f.balance} onChange={set("balance")} /></Field>
      </div>
      <div className="ops-form-acts">
        <button className="ops-btn" disabled={saving} onClick={() => onSave(f)}>{saving ? <span className="ops-spin" /> : <i className="fa-solid fa-check" />}{initial ? "Save changes" : "Create customer"}</button>
        <button className="ops-btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ScenarioForm({ initial, saving, onSave, onCancel }) {
  const [f, setF] = useState({
    key: initial?.key || "",
    tag: initial?.tag || "",
    expected_decision: initial?.expected_decision || "warn",
    title: initial?.title || "",
    description: initial?.description || "",
    flow: initial?.flow || "p2p",
    sender_ref: initial?.preset?.sender || initial?.sender_ref || "",
    recipient_ref: initial?.preset?.recipient || initial?.recipient_ref || "",
    amount: initial?.preset?.amount ?? initial?.amount ?? 10000,
  });
  const set = (k) => (e) => {
    const v = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setF({ ...f, [k]: v });
  };
  const submit = () => {
    const p = { ...f };
    if (!p.description) delete p.description;
    if (!p.amount) delete p.amount;
    onSave(p);
  };
  return (
    <div className="ops-form">
      <div className="ops-form-row">
        <Field label="Key"><input className="ops-select" value={f.key} onChange={set("key")} disabled={!!initial} placeholder="high-amount-first-transfer" /></Field>
        <Field label="Tag"><input className="ops-select" value={f.tag} onChange={set("tag")} placeholder="NEW" /></Field>
        <Field label="Expected decision">
          <select className="ops-select" value={f.expected_decision} onChange={set("expected_decision")}>
            <option value="allow">allow</option><option value="warn">warn</option>
            <option value="hold">hold</option><option value="block">block</option>
          </select>
        </Field>
        <Field label="Title"><input className="ops-select" value={f.title} onChange={set("title")} /></Field>
        <Field label="Description"><input className="ops-select" value={f.description} onChange={set("description")} /></Field>
        <Field label="Flow">
          <select className="ops-select" value={f.flow} onChange={set("flow")}>
            <option value="p2p">p2p</option><option value="bank">bank</option><option value="ussd">ussd</option>
          </select>
        </Field>
        <Field label="Sender ref"><input className="ops-select" value={f.sender_ref} onChange={set("sender_ref")} /></Field>
        <Field label="Recipient ref"><input className="ops-select" value={f.recipient_ref} onChange={set("recipient_ref")} /></Field>
        <Field label="Amount (TZS)"><input className="ops-select" type="number" min={0} value={f.amount} onChange={set("amount")} /></Field>
      </div>
      <div className="ops-form-acts">
        <button className="ops-btn" disabled={saving} onClick={submit}>{saving ? <span className="ops-spin" /> : <i className="fa-solid fa-check" />}{initial ? "Save changes" : "Create scenario"}</button>
        <button className="ops-btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
function Audit({ creds }) {
  const [tenantId, setTenantId] = useState("tenant-test-0001");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  async function run() {
    setLoading(true); setErr(null); setRes(null);
    try { setRes(await opRequest(creds, "GET", `/v1/audit/verify/${tenantId.trim()}`)); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }
  return (
    <div className="ops-panel">
      <div className="ops-panel-head">
        <div><h3>Verify the audit chain</h3><p className="sub">Every action is hash-chained to the previous — tampering breaks the chain</p></div>
      </div>
      <div className="ops-panel-body" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input className="ops-select" style={{ width: 240, color: "#fff" }} value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        <button className="ops-btn" onClick={run} disabled={loading}>{loading ? <span className="ops-spin" /> : <i className="fa-solid fa-link" />}Verify chain</button>
      </div>
      {err && <div className="ops-err">{err}</div>}
      {res && (
        <div className="ops-panel-body" style={{ borderTop: "1px solid #191919" }}>
          <p className="ops-note">HTTP {res.status}</p>
          <pre style={{ color: "#FFC533", fontSize: 12, fontFamily: "JetBrains Mono, monospace", whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 380 }}>{JSON.stringify(res.body, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}