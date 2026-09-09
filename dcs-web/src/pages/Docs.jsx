import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function CodeBlock({ tabs, contents }) {
  const [active, setActive] = useState(tabs[0].key);
  return (
    <div className="code-block">
      <div className="code-block-head">
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={active === t.key ? "tab active" : "tab"}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="copy-btn">
          <i className="fa-regular fa-copy" />
          <span>Copy</span>
        </button>
      </div>
      {contents.map((c) => (
        <pre key={c.key} style={{ display: active === c.key ? "block" : "none" }}>
          <code>{c.body}</code>
        </pre>
      ))}
    </div>
  );
}

function Callout({ type = "info", children }) {
  return (
    <div className={"callout " + (type === "warn" ? "callout-warn" : "callout-info")}>
      <i className={"fa-solid " + (type === "warn" ? "fa-triangle-exclamation" : "fa-circle-info")} />
      <div>{children}</div>
    </div>
  );
}

/* ---------- shared signed-request JS snippet ---------- */
const SIGNED_NODE = (
  <>
    <span className="tok-k">const</span> <span className="tok-f">crypto</span> = <span className="tok-f">require</span>(<span className="tok-s">"node:crypto"</span>);{"\n"}
    {"\n"}
    <span className="tok-c">// 1. Build the message exactly: ts.method.path.query.body</span>{"\n"}
    <span className="tok-k">const</span> timestamp = <span className="tok-f">String</span>(<span className="tok-f">Date</span>.<span className="tok-f">now</span>());{"\n"}
    <span className="tok-k">const</span> nonce = <span className="tok-f">crypto</span>.<span className="tok-f">randomUUID</span>();{"\n"}
    <span className="tok-k">const</span> method = <span className="tok-s">"POST"</span>;{"\n"}
    <span className="tok-k">const</span> pathname = <span className="tok-s">"/v1/transactions/validate"</span>;{"\n"}
    <span className="tok-k">const</span> query = <span className="tok-s">""</span>;{"\n"}
    <span className="tok-k">const</span> body = <span className="tok-f">JSON</span>.<span className="tok-f">stringify</span>(payload); <span className="tok-c">// "" when there is no body</span>{"\n"}
    <span className="tok-k">const</span> message = [timestamp, method, pathname, query, body].<span className="tok-f">join</span>(<span className="tok-s">"."</span>);{"\n"}
    {"\n"}
    <span className="tok-c">// 2. HMAC-SHA256 with the signing secret</span>{"\n"}
    <span className="tok-k">const</span> signature = <span className="tok-f">crypto</span>{"\n"}
    {"  "}.<span className="tok-f">createHmac</span>(<span className="tok-s">"sha256"</span>, SIGNING_SECRET){"\n"}
    {"  "}.<span className="tok-f">update</span>(message).<span className="tok-f">digest</span>(<span className="tok-s">"hex"</span>);{"\n"}
    {"\n"}
    <span className="tok-c">// 3. Send with the required headers</span>{"\n"}
    headers = {"{"}{"\n"}
    {"  "}<span className="tok-s">"x-tenant-key"</span>: <span className="tok-s">"test-api-key-0001"</span>,{"\n"}
    {"  "}<span className="tok-s">"x-timestamp"</span>: timestamp,{"\n"}
    {"  "}<span className="tok-s">"x-nonce"</span>: nonce,{"\n"}
    {"  "}<span className="tok-s">"x-signature"</span>: signature,{"\n"}
    {"  "}<span className="tok-s">"content-type"</span>: <span className="tok-s">"application/json"</span>,{"\n"}
    {"}"};
  </>
);

const CURL_VALIDATE = (
  <>
    <span className="tok-k">curl</span> <span className="tok-f">-X POST</span> <span className="tok-s">http://localhost:8080/v1/transactions/validate</span> \{"\n"}
    {"  "}<span className="tok-k">-H</span> <span className="tok-s">"x-tenant-key: test-api-key-0001"</span> \{"\n"}
    {"  "}<span className="tok-k">-H</span> <span className="tok-s">"x-timestamp: 1720000000000"</span> \{"\n"}
    {"  "}<span className="tok-k">-H</span> <span className="tok-s">"x-nonce: 4f2a…-uuid"</span> \{"\n"}
    {"  "}<span className="tok-k">-H</span> <span className="tok-s">"x-signature: &lt;hmac-sha256-hex&gt;"</span> \{"\n"}
    {"  "}<span className="tok-k">-H</span> <span className="tok-s">"content-type: application/json"</span> \{"\n"}
    {"  "}<span className="tok-k">-d</span> <span className="tok-s">{"\'{"}{"\n"}
    {'    "tenant_txn_ref": "TX-1001",'}{"\n"}
    {'    "user_external_ref": "255712345678",'}{"\n"}
    {'    "amount": 120000,'}{"\n"}
    {'    "currency": "TZS",'}{"\n"}
    {'    "channel": "mobile_money",'}{"\n"}
    {'    "recipient_external_ref": "255714567890",'}{"\n"}
    {'    "device_fingerprint": "device-a1b2c3"'}{"\n"}
    {"  }'"}</span>
  </>
);

const RESP_VALIDATE = (
  <>
    {"{"}{"\n"}
    {"  "}<span className="tok-s">"transaction_id"</span>: <span className="tok-s">"txn_1a2b3c"</span>,{"\n"}
    {"  "}<span className="tok-s">"model_version"</span>: <span className="tok-s">"v1"</span>,{"\n"}
    {"  "}<span className="tok-s">"risk_score"</span>: <span className="tok-n">72.4</span>,{"\n"}
    {"  "}<span className="tok-s">"decision"</span>: <span className="tok-s">"hold"</span>,{"\n"}
    {"  "}<span className="tok-s">"reason_codes"</span>: [<span className="tok-s">"HIGH_TXN_VELOCITY"</span>, <span className="tok-s">"DEVICE_CHANGE"</span>],{"\n"}
    {"  "}<span className="tok-s">"advisory"</span>: {"{"}<span className="tok-s">"message"</span>: <span className="tok-s">"Unusual device or velocity — hold for customer confirmation."</span>{"}"},{"\n"}
    {"  "}<span className="tok-s">"hold"</span>: {"{"}<span className="tok-s">"hold_id"</span>: <span className="tok-s">"hold_88ab"</span>, <span className="tok-s">"status"</span>: <span className="tok-s">"pending"</span>, <span className="tok-s">"ttl_seconds"</span>: <span className="tok-n">1800</span>{"}"}{"\n"}
    {"}"}
  </>
);

export default function Docs() {
  const [sideOpen, setSideOpen] = useState(false);

  function handleSideClick(e) {
    if (window.innerWidth <= 960 && e.target.closest("a")) setSideOpen(false);
  }

  useEffect(() => {
    const links = Array.prototype.slice.call(document.querySelectorAll(".docs-side a[data-nav]"));
    const sections = links.map((l) => document.querySelector(l.getAttribute("href"))).filter(Boolean);

    function onScroll() {
      const pos = window.scrollY + 140;
      let current = sections[0];
      for (const s of sections) if (s.offsetTop <= pos) current = s;
      links.forEach((l) => {
        const isActive = current && l.getAttribute("href") === "#" + current.id;
        l.classList.toggle("active", isActive);
      });
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="docs-shell">
      <button className="docs-side-toggle" onClick={() => setSideOpen((v) => !v)}>
        <i className="fa-solid fa-bars" />
        Table of contents
      </button>

      <aside className={sideOpen ? "docs-side open" : "docs-side"} onClick={handleSideClick}>
        <h5>Getting started</h5>
        <a href="#overview" data-nav>Overview</a>
        <a href="#quickstart" data-nav>Quickstart</a>
        <a href="#authentication" data-nav>Authentication</a>
        <a href="#signature" data-nav>Signing requests</a>

        <h5>Decision model</h5>
        <a href="#decision-model" data-nav>Four-band scoring</a>
        <a href="#reason-codes" data-nav>Reason codes</a>

        <h5>API reference</h5>
        <a href="#validate" data-nav>POST /v1/transactions/validate</a>
        <a href="#verify" data-nav>POST /v1/recipients/verify</a>
        <a href="#lookup" data-nav>GET /v1/transactions/:id</a>
        <a href="#holds" data-nav>Freeze / release holds</a>
        <a href="#disputes" data-nav>Disputes</a>
        <a href="#webhooks" data-nav>Webhooks</a>
        <a href="#audit" data-nav>Audit chain</a>
        <a href="#operations" data-nav>Ops &amp; key rotation</a>

        <h5>Resources</h5>
        <a href="#errors" data-nav>Errors</a>
        <a href="#sandbox" data-nav>Sandbox &amp; testing</a>
        <a href="#support" data-nav>Support</a>
      </aside>

      <main className="docs-main">
        <div className="docs-crumb">
          <Link to="/">Home</Link>
          <i className="fa-solid fa-chevron-right" style={{ fontSize: 10 }} />
          API documentation dashboard
        </div>

        <h1>Digital Consumer Shield API</h1>
        <p className="lead">
          Everything you need to sign requests, score a transaction, verify a recipient, and run
          holds and disputes through the DCS protection layer.
        </p>

        <section className="doc-section" id="overview">
          <div className="doc-intro">
            <p>
              <b>DCS</b> sits in front of your payment gateway and answers one question in real
              time: <b>is this transfer safe?</b> It verifies the recipient, scores the
              transaction against the customer's own behavioural baseline, and holds or blocks
              the transfers that predict money loss — before money moves.
            </p>
          </div>
          <p>
            Every request is signed with HMAC-SHA256, protected against replay with a one-time
            nonce, and must arrive inside a 5-minute timestamp window. Every decision is written
            to a tamper-evident audit chain.
          </p>
          <h3>What happens to every request</h3>
          <ol>
            <li><b>Authentication</b> — HMAC signature, timestamp window and nonce are verified.</li>
            <li><b>Tenant resolution</b> — the API key maps to a tenant shielding policy.</li>
            <li><b>Validation</b> — the payload is checked against the DCS schema.</li>
            <li><b>Recipient verification</b> — the receiving number is resolved to a masked name and risk profile.</li>
            <li><b>Fraud scoring</b> — the transaction is scored against the customer baseline.</li>
            <li><b>Decision</b> — one of allow, warn, hold or block, with reason codes.</li>
          </ol>
          <Callout type="info">
            This documentation covers the REST API directly. There is a live{" "}
            <Link to="/simulator" className="inline">transaction simulator</Link> and a{" "}
            <Link to="/ops" className="inline">ops console</Link> that drive the same endpoints.
          </Callout>
        </section>

        <section className="doc-section" id="quickstart">
          <h2><span className="hash">#</span>Quickstart</h2>
          <p>Get from zero to a scored transaction in four steps:</p>
          <ol>
            <li>Confirm the sandbox API is running (see the <Link to="/sandbox" className="inline">sandbox</Link> section for credentials).</li>
            <li>Create a transaction payload.</li>
            <li>Sign the request — timestamp, nonce and HMAC — as shown below.</li>
            <li>POST to <code>/v1/transactions/validate</code> and read the decision.</li>
          </ol>

          <h3>Sign every request</h3>
          <CodeBlock
            tabs={[{ key: "node", label: "Node.js" }, { key: "curl", label: "curl (concept)" }]}
            contents={[
              { key: "node", body: SIGNED_NODE },
              { key: "curl", body: CURL_VALIDATE },
            ]}
          />

          <h3>First scored transaction</h3>
          <CodeBlock
            tabs={[{ key: "resp", label: "Response" }]}
            contents={[{ key: "resp", body: RESP_VALIDATE }]}
          />

          <Callout type="warn">Never reuse a nonce and never send stale timestamps — the API rejects them.</Callout>
        </section>

        <section className="doc-section" id="authentication">
          <h2><span className="hash">#</span>Authentication</h2>
          <p>
            Two credential classes exist. Tenant requests are signed with HMAC using the signing
            secret. Ops requests use a bearer token and bypass the tenant layer.
          </p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Class</th><th>Header</th><th>Use</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>x-tenant-key</code></td><td>Tenant API key</td>
                  <td>Identifies the shielding tenant. Required on all signed (tenant) requests.</td>
                </tr>
                <tr>
                  <td><code>Authorization: Bearer</code></td><td>Ops token</td>
                  <td>Operator actions: freeze, resolve, audit, key rotation. Replaces tenant signing.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout type="warn">
            Treat the signing secret like a password. If it leaks, rotate it with the ops endpoint —
            the old secret stops working on the next request.
          </Callout>
        </section>

        <section className="doc-section" id="signature">
          <h2><span className="hash">#</span>Signing requests</h2>
          <p>Every tenant request must carry four headers:</p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Header</th><th>Required</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>x-tenant-key</code></td><td>yes</td><td>The tenant's API key.</td></tr>
                <tr><td><code>x-timestamp</code></td><td>yes</td><td>Unix milliseconds. Marginally stale requests are rejected.</td></tr>
                <tr><td><code>x-nonce</code></td><td>yes</td><td>Unique per request (UUID). Reuse is rejected as a replay.</td></tr>
                <tr><td><code>x-signature</code></td><td>yes</td><td>HMAC-SHA256 hex digest of the signature message.</td></tr>
              </tbody>
            </table>
          </div>
          <h3>Signature message</h3>
          <p>
            The signed message is the five parts joined by dots, in this exact order:
          </p>
          <CodeBlock
            tabs={[{ key: "msg", label: "Message format" }]}
            contents={[
              {
                key: "msg",
                body: (
                  <><span className="tok-e">timestamp</span>.<span className="tok-e">method</span>.<span className="tok-e">pathname</span>.<span className="tok-e">query</span>.<span className="tok-e">body</span></>
                ),
              },
            ]}
          />
          <ul>
            <li><code>method</code> — uppercase HTTP verb (GET, POST, PATCH).</li>
            <li><code>pathname</code> — e.g. <code>/v1/transactions/validate</code> (no query string).</li>
            <li><code>query</code> — raw query string, or an empty string when there is none.</li>
            <li><code>body</code> — exact JSON payload, or an empty string for GET / empty bodies.</li>
          </ul>
          <Callout type="info">
            The message is exactly <code>crypto.createHmac("sha256", SIGNING_SECRET).update(message).digest("hex")</code>.
            The browser demo in this project signs with the Web Crypto API — same output byte-for-byte.
          </Callout>
        </section>

        <section className="doc-section" id="decision-model">
          <h2><span className="hash">#</span>Four-band scoring</h2>
          <p>
            Every validated transaction returns a <code>risk_score</code> between 0 and 100 and
            exactly one decision taken from the four bands below.
          </p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Decision</th><th>Score</th><th>Behaviour</th></tr>
              </thead>
              <tbody>
                <tr><td><code>allow</code></td><td>&lt; 25</td><td>Settle normally.</td></tr>
                <tr><td><code>warn</code></td><td>25 – 59</td><td>Advisory only. Returns reason codes so the gateway can decide; may still settle.</td></tr>
                <tr><td><code>hold</code></td><td>60 – 79</td><td>Funds are held (30-minute TTL) pending customer confirmation; a webhook fires.</td></tr>
                <tr><td><code>block</code></td><td>&ge; 80</td><td>Transfer is rejected outright — it never reaches the gateway.</td></tr>
              </tbody>
            </table>
          </div>
          <Callout type="warn">
            A held transaction is <i>not</i> settled until it is released. Customers and operators
            coordinate through the hold lifecycle — see Holds below.
          </Callout>
        </section>

        <section className="doc-section" id="reason-codes">
          <h2><span className="hash">#</span>Reason codes</h2>
          <p>
            Each decision carries the fraud signals that fired, which is what makes DCS explainable
            rather than a black box.
          </p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Code</th><th>Meaning</th><th>Weight</th></tr>
              </thead>
              <tbody>
                <tr><td><code>AMOUNT_ABOVE_BASELINE</code></td><td>Amount far above the customer's historical average.</td><td>high</td></tr>
                <tr><td><code>HIGH_TXN_VELOCITY</code></td><td>More than five transfers in one hour.</td><td>high</td></tr>
                <tr><td><code>DEVICE_CHANGE</code></td><td>Transaction from a device the customer has never used.</td><td>high</td></tr>
                <tr><td><code>DAY_ZERO_TRUST</code></td><td>Customer account created today (cold start).</td><td>medium</td></tr>
                <tr><td><code>MULTI_RECIPIENT_HOLD</code></td><td>Funds fan out to many new recipients quickly.</td><td>medium</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="doc-section" id="validate">
          <h2><span className="hash">#</span>POST /v1/transactions/validate</h2>
          <p>
            The core endpoint. Scores a transaction and returns a decision before it reaches the
            gateway.
          </p>
          <h3>Request fields</h3>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>tenant_txn_ref</code></td><td>string</td><td>yes</td><td>Your transaction reference (idempotency key).</td></tr>
                <tr><td><code>user_external_ref</code></td><td>string</td><td>yes</td><td>The payer — phone number or account ID.</td></tr>
                <tr><td><code>amount</code></td><td>number</td><td>yes</td><td>Amount in the smallest unit of <code>currency</code>.</td></tr>
                <tr><td><code>currency</code></td><td>string</td><td>yes</td><td>ISO 4217 code, e.g. <code>TZS</code>.</td></tr>
                <tr><td><code>channel</code></td><td>string</td><td>yes</td><td><code>mobile_money</code>, <code>bank</code>, <code>internet</code>, <code>ussd</code>, <code>pos</code>, <code>qr</code>.</td></tr>
                <tr><td><code>recipient_external_ref</code></td><td>string</td><td>yes</td><td>The payee's number or account ID.</td></tr>
                <tr><td><code>device_fingerprint</code></td><td>string</td><td>no</td><td>Stable device identifier — weights the device-change signal.</td></tr>
                <tr><td><code>occurred_at</code></td><td>string</td><td>no</td><td>ISO 8601 timestamp. Defaults to now.</td></tr>
              </tbody>
            </table>
          </div>
          <h3>Response — 200 OK</h3>
          <CodeBlock
            tabs={[{ key: "resp", label: "JSON" }]}
            contents={[{ key: "resp", body: RESP_VALIDATE }]}
          />
        </section>

        <section className="doc-section" id="verify">
          <h2><span className="hash">#</span>POST /v1/recipients/verify</h2>
          <p>
            Resolves a recipient number to a masked registered name and risk profile. Call this
            before the customer confirms a transfer — it is the human trigger that stops
            wrong-number payments.
          </p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
              </thead>
              <tbody>
                <tr><td><code>recipient_external_ref</code></td><td>string</td><td>yes</td><td>The number or account to verify.</td></tr>
                <tr><td><code>channel</code></td><td>string</td><td>yes</td><td>Channel used for the likely transfer.</td></tr>
                <tr><td><code>tenant_txn_ref</code></td><td>string</td><td>yes</td><td>Your reference (audit correlation).</td></tr>
              </tbody>
            </table>
          </div>
          <h3>Response — 200 OK</h3>
          <CodeBlock
            tabs={[{ key: "resp", label: "JSON" }]}
            contents={[
              {
                key: "resp",
                body: (
                  <>{`{`}{"\n"}
                    {"  "}<span className="tok-s">"verification_id"</span>: <span className="tok-s">"fb4bec69…"</span>,{"\n"}
                    {"  "}<span className="tok-s">"verified"</span>: <span className="tok-k">true</span>,{"\n"}
                    {"  "}<span className="tok-s">"recipient_display_name"</span>: <span className="tok-s">"J**A M***D"</span>,{"\n"}
                    {"  "}<span className="tok-s">"account_age_days"</span>: <span className="tok-n">1850</span>,{"\n"}
                    {"  "}<span className="tok-s">"first_time_recipient"</span>: <span className="tok-k">false</span>,{"\n"}
                    {"  "}<span className="tok-s">"channel"</span>: <span className="tok-s">"mobile_money"</span>{"\n"}
                    {"}"}
                  </>
                ),
              },
            ]}
          />
          <Callout type="info">
            The name is masked by design — the operator sees just enough to confirm identity, and
            the response is emergency-safe to display to end users.
          </Callout>
        </section>

        <section className="doc-section" id="lookup">
          <h2><span className="hash">#</span>GET /v1/transactions/:id</h2>
          <p>
            Fetch a previously validated transaction by its DCS <code>transaction_id</code>.
          </p>
          <CodeBlock
            tabs={[{ key: "node", label: "Node.js" }, { key: "curl", label: "curl" }]}
            contents={[
              {
                key: "node",
                body: (
                  <>
                    <span className="tok-k">const</span> res = <span className="tok-k">await</span> <span className="tok-f">fetch</span>({"`"}BASE<span className="tok-s">"/v1/transactions/txn_1a2b3c"</span>{"`"}, {"{"} <span className="tok-f">headers</span> {"}"});{"\n"}
                    <span className="tok-c">{"//  GET /v1/transactions/:id  (tenant-signed)"}</span>
                  </>
                ),
              },
              {
                key: "curl",
                body: (
                  <>
                    <span className="tok-k">curl</span> <span className="tok-s">http://localhost:8080/v1/transactions/txn_1a2b3c</span> \{"\n"}
                    {"  "}<span className="tok-k">-H</span> <span className="tok-s">"x-tenant-key: test-api-key-0001"</span> \{"\n"}
                    {"  "}<span className="tok-k">-H</span> <span className="tok-s">"x-timestamp: …"</span> <span className="tok-k">-H</span> <span className="tok-s">"x-nonce: …"</span> \{"\n"}
                    {"  "}<span className="tok-k">-H</span> <span className="tok-s">"x-signature: &lt;hmac-sha256-hex&gt;"</span>
                  </>
                ),
              },
            ]}
          />
          <Callout type="warn">
            Lookup is tenant-scoped. A different tenant's key reading your transaction id returns{" "}
            <code>404</code>, not the transaction — tenant isolation is enforced on every path.
          </Callout>
        </section>

        <section className="doc-section" id="holds">
          <h2><span className="hash">#</span>Freeze / release holds</h2>
          <p>
            A <code>hold</code> decision returns a <code>hold_id</code> with a 30-minute TTL.
            While held, the transfer is not settled. Two actions control it:
          </p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Endpoint</th><th>Auth</th><th>Effect</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>POST /v1/holds/:id/freeze</code></td><td>ops bearer</td>
                  <td>Freezes the hold — funds stay put while an investigation runs.</td>
                </tr>
                <tr>
                  <td><code>POST /v1/holds/:id/release</code></td><td>tenant-signed</td>
                  <td>Clears the hold so the settlement proceeds.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout type="warn">
            A frozen hold cannot be released directly — the API returns <code>409</code> until the
            associated dispute is resolved. This is the investigation guard.
          </Callout>
        </section>

        <section className="doc-section" id="disputes">
          <h2><span className="hash">#</span>Disputes</h2>
          <p>
            When a customer says "I did not authorize this", the tenant files a dispute on the
            hold. The operator investigates and resolves against the audit trail.
          </p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Endpoint</th><th>Auth</th><th>Request</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>POST /v1/disputes</code></td><td>tenant-signed</td>
                  <td><code>{"{ hold_id, reason }"}</code> → <code>201 dispute_id</code></td>
                </tr>
                <tr>
                  <td><code>PATCH /v1/disputes/:id</code></td><td>ops bearer</td>
                  <td><code>{'{ outcome: "approved" | "rejected", note }'}</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="doc-section" id="webhooks">
          <h2><span className="hash">#</span>Webhooks</h2>
          <p>
            Subscribe to hold and dispute events so the corridor is notified the moment a
            transfer is held.
          </p>
          <CodeBlock
            tabs={[{ key: "req", label: "POST /v1/webhooks/subscribe" }]}
            contents={[
              {
                key: "req",
                body: (
                  <>
                    {"{"}{"\n"}
                    {"  "}<span className="tok-s">"callback_url"</span>: <span className="tok-s">"https://corridor.example/dcs/hooks"</span>,{"\n"}
                    {"  "}<span className="tok-s">"events"</span>: [<span className="tok-s">"HOLD_CREATED"</span>]{"\n"}
                    {"}"}
                  </>
                ),
              },
            ]}
          />
          <Callout type="warn">
            The sandbox shows the <code>status: "active"</code> subscription. Webhook payloads are
            signed so consumers can verify the source.
          </Callout>
        </section>

        <section className="doc-section" id="audit">
          <h2><span className="hash">#</span>Audit chain</h2>
          <p>
            Every decision, hold and dispute is appended to a hash-chained, per-tenant audit log.
            Verifying recomputes the whole chain — any tampering anywhere breaks it.
          </p>
          <CodeBlock
            tabs={[{ key: "req", label: "GET /v1/audit/verify/:tenantId" }]}
            contents={[
              {
                key: "req",
                body: (
                  <>
                    <span className="tok-k">curl</span> <span className="tok-s">http://localhost:8080/v1/audit/verify/tenant-test-0001</span> \{"\n"}
                    {"  "}<span className="tok-k">-H</span> <span className="tok-s">"authorization: Bearer ops-secret-token-0001"</span>{"\n"}
                    {"\n"}
                    <span className="tok-c">{"// → { valid: true, entries: 19 }"}</span>
                  </>
                ),
              },
            ]}
          />
        </section>

        <section className="doc-section" id="operations">
          <h2><span className="hash">#</span>Ops &amp; key rotation</h2>
          <p>
            Operator actions for onboarding and credential hygiene:
          </p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Endpoint</th><th>Auth</th><th>Use</th></tr>
              </thead>
              <tbody>
                <tr><td><code>POST /v1/ops/tenants/:id/rotate-api-key</code></td><td>ops bearer</td><td>Issue a new tenant API key; the old one stops working.</td></tr>
                <tr><td><code>POST /v1/ops/tenants/:id/rotate-signing-key</code></td><td>ops bearer</td><td>Issue a new HMAC signing secret; old requests are rejected.</td></tr>
              </tbody>
            </table>
          </div>
          <Callout type="info">
            Both rotations are audit-logged (<code>api_key_rotated</code> / <code>signing_key_rotated</code>)
            so key history is traceable.
          </Callout>
        </section>

        <section className="doc-section" id="errors">
          <h2><span className="hash">#</span>Errors</h2>
          <p>Errors always return a JSON body with a stable <code>error</code> code.</p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Status</th><th>Code</th><th>Meaning</th></tr>
              </thead>
              <tbody>
                <tr><td><code>400</code></td><td><code>invalid_request</code></td><td>Malformed body or failed schema validation.</td></tr>
                <tr><td><code>401</code></td><td><code>invalid_key</code></td><td>Missing or unknown tenant key / ops token.</td></tr>
                <tr><td><code>401</code></td><td><code>stale_timestamp</code></td><td>Signature timestamp outside the acceptable window.</td></tr>
                <tr><td><code>401</code></td><td><code>invalid_signature</code></td><td>HMAC verification failed (tampered request).</td></tr>
                <tr><td><code>403</code></td><td><code>forbidden</code></td><td>Known key but caller lacks permission for this action.</td></tr>
                <tr><td><code>404</code></td><td><code>not_found</code></td><td>Unknown id — or a resource owned by another tenant.</td></tr>
                <tr><td><code>409</code></td><td><code>replay_detected</code></td><td>The nonce was already used.</td></tr>
                <tr><td><code>409</code></td><td><code>hold_not_releasable</code></td><td>A frozen hold was released before its dispute resolved.</td></tr>
                <tr><td><code>409</code></td><td><code>idempotency_conflict</code></td><td>The same transaction reference arrived with different content.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="doc-section" id="sandbox">
          <h2><span className="hash">#</span>Sandbox &amp; testing</h2>
          <p>
            The sandbox mirrors production with deterministic test data — no real money moves.
          </p>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>Tenant</th><th>API key</th><th>Signing secret</th><th>Policy</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Test bank</td><td><code>test-api-key-0001</code></td><td><code>test-signing-key-0001</code></td><td>fail-open</td>
                </tr>
                <tr>
                  <td>Test MNO</td><td><code>mno-api-key-0002</code></td><td><code>mno-signing-key-0002</code></td><td>fail-closed</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>Activities that reproduce each decision:</p>
          <ul>
            <li><b>warn</b> — a large, untypical amount or a brand-new customer on day zero.</li>
            <li><b>hold</b> — five transfers in the hour, then a sixth from a different <code>device_fingerprint</code>.</li>
            <li><b>block</b> — a very large amount far above baseline <i>plus</i> a changed device.</li>
          </ul>
          <p>The ops token is <code>ops-secret-token-0001</code>. Run the full live test harness with:</p>
          <CodeBlock
            tabs={[{ key: "run", label: "Smoke test" }]}
            contents={[
              {
                key: "run",
                body: (
                  <>
                    <span className="tok-k">cd</span> dcs-api{"\n"}
                    node <span className="tok-f">scripts/api-smoke.mjs</span>{"\n"}
                    <span className="tok-c">{"// → 22 checks: health, 401s, replay → 409, verify, validate,"}</span>{"\n"}
                    <span className="tok-c">//   hold → freeze → dispute → resolve → release, isolation</span>
                  </>
                ),
              },
            ]}
          />
        </section>

        <section className="doc-section" id="support">
          <h2><span className="hash">#</span>Support</h2>
          <ul>
            <li><b>Repository &amp; issues</b> — <a href="https://github.com/DICKSON78/DCS" target="_blank" rel="noreferrer" className="inline">github.com/DICKSON78/DCS</a>.</li>
            <li><b>Local API docs</b> — Swagger UI at <code>http://localhost:8080/docs</code>.</li>
            <li><b>Product</b> — Digital Consumer Shield, Dr. Mshindi Andrew Rwamuhuru.</li>
          </ul>
          <Callout type="warn">
            Never ship <code>test-*</code> keys to production. Keys and secrets are supplied
            through environment or secrets vaults (<code>OPS_BEARER_TOKEN_FILE</code> pattern).
          </Callout>
        </section>
      </main>
    </div>
  );
}