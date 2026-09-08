import { Link } from "react-router-dom";

const SCENARIOS = [
  {
    icon: "fa-user-check",
    title: "Wrong-number transfers",
    body: "One wrong digit sends money to a stranger with no way to recover it. DCS shows the masked registered name before the transfer so the customer confirms who they are sending to.",
    cta: "Try recipient verification",
    to: "/verify",
  },
  {
    icon: "fa-triangle-exclamation",
    title: "Stolen devices & SIM swap",
    body: "An attacker on the customer's phone drains the account in minutes. A change of device fingerprint on the account is flagged and the transfer is held.",
    cta: "Trigger a device-change hold",
    to: "/simulator",
  },
  {
    icon: "fa-arrow-trend-up",
    title: "Rapid-drain attacks",
    body: "Many small transfers that slip under monitoring radar. High velocity — more than five transfers inside an hour — is scored up and held before the drain completes.",
    cta: "Run a velocity burst",
    to: "/simulator",
  },
  {
    icon: "fa-people-arrows",
    title: "Mule accounts",
    body: "Brand-new accounts that receive money and forward it. Cold-start customers (day zero) and multi-recipient funneling patterns are flagged for review.",
    cta: "Score a cold-start transfer",
    to: "/simulator",
  },
  {
    icon: "fa-clock-rotate-left",
    title: "Replay & tampering in the corridor",
    body: "Every request is signed with HMAC-SHA256 over a timestamp window plus a one-time nonce. A replayed or tampered request is rejected before it is processed.",
    cta: "See signed requests in action",
    to: "/simulator",
  },
  {
    icon: "fa-scale-balanced",
    title: "Disputes & holds",
    body: "When funds are held, the customer can file a dispute and an operator investigates to a 48-hour SLA, then approves or rejects while the hold stays frozen.",
    cta: "Open the ops console",
    to: "/ops",
  },
];

const BANDS = [
  { decision: "allow", score: "< 25", color: "badge-allow", text: "Settle normally — no signals fired or only weak ones." },
  { decision: "warn", score: "25–59", color: "badge-warn", text: "Advisory only. Returns reason codes so the gateway can decide; may still settle." },
  { decision: "hold", score: "60–79", color: "badge-hold", text: "Funds are held for 30 minutes pending customer confirmation; webhook notified." },
  { decision: "block", score: "≥ 80", color: "badge-block", text: "Transfer is rejected outright — the transaction never reaches the gateway." },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">Digital Consumer Shield</span>
          <h1>
            One question before money settles:{" "}
            <span className="grad-text">is this transfer safe?</span>
          </h1>
          <p>
            DCS sits in front of a payment gateway and answers that question in real time for
            Tanzania's banks, mobile-money operators, GePG and TIPS. It verifies the recipient,
            scores the transaction against the customer's own behaviour, and holds or blocks the
            transfers that predict money loss — before the money moves.
          </p>
          <div className="hero-cta">
            <Link to="/simulator" className="btn">
              <i className="fa-solid fa-bolt" /> Try the transaction simulator
            </Link>
            <Link to="/verify" className="btn btn-ghost">
              <i className="fa-solid fa-user-check" /> Verify a recipient
            </Link>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <strong>0.30s</strong>
              <span>decision time (p99 SLA)</span>
            </div>
            <div className="stat">
              <strong>4 bands</strong>
              <span>allow → warn → hold → block</span>
            </div>
            <div className="stat">
              <strong>5 min</strong>
              <span>signature timestamp window</span>
            </div>
            <div className="stat">
              <strong>48 hr</strong>
              <span>dispute resolution SLA</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">Why DCS exists</span>
            <h2>Real money is lost today through predictable gaps</h2>
            <p>
              DCS closes the six patterns that cause the most consumer money loss in Tanzanian
              payments. Each card below is a live, interactive demonstration.
            </p>
          </div>

          <div className="grid grid-2">
            {SCENARIOS.map((s) => (
              <Link key={s.title} to={s.to} className="card card-link">
                <h3>
                  <i className={"fa-solid " + s.icon} style={{ color: "var(--accent)" }} />
                  {s.title}
                </h3>
                <p>{s.body}</p>
                <p className="step mt">{s.cta} →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad" style={{ background: "var(--ink-2)" }}>
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">How decisions work</span>
            <h2>Four bands. One clear answer.</h2>
          </div>
          <div className="card">
            <table className="bands" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Decision</th>
                  <th>Score</th>
                  <th>What happens</th>
                </tr>
              </thead>
              <tbody>
                {BANDS.map((b) => (
                  <tr key={b.decision}>
                    <td>
                      <span className={"badge " + b.color}>{b.decision.toUpperCase()}</span>
                    </td>
                    <td className="mono">{b.score}</td>
                    <td>{b.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-pad">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">The tools</span>
            <h2>Three consoles, one protection layer</h2>
          </div>
          <div className="grid grid-3">
            <div className="card">
              <h3>
                <i className="fa-solid fa-bolt" style={{ color: "var(--accent)" }} /> Simulator
              </h3>
              <p>
                Fire real transactions at the DCS rule engine. Watch the risk score climb as
                devices change and velocity builds — and see exactly which fraud signals fired.
              </p>
              <Link to="/simulator" className="btn btn-sm mt">
                Open simulator
              </Link>
            </div>
            <div className="card">
              <h3>
                <i className="fa-solid fa-user-check" style={{ color: "var(--accent)" }} /> Recipient
                verification
              </h3>
              <p>
                Check a phone number before the transfer. See the masked registered name, how
                long the account has existed, and whether this is a first-time recipient.
              </p>
              <Link to="/verify" className="btn btn-sm mt">
                Open verification
              </Link>
            </div>
            <div className="card">
              <h3>
                <i className="fa-solid fa-scale-balanced" style={{ color: "var(--accent)" }} /> Ops
                console
              </h3>
              <p>
                The operator view: freeze a hold, release a hold, file and resolve disputes,
                look up a transaction, and prove the audit chain is untampered.
              </p>
              <Link to="/ops" className="btn btn-sm mt">
                Open ops console
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}