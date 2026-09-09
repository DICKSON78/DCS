import { useEffect, useMemo, useState } from "react";
import { dcsRequest } from "../lib/api.js";
import { useCredentials } from "../lib/credentials.jsx";
import DecisionBadge from "../components/DecisionBadge.jsx";

const nf = (n) => (typeof n === "number" ? "TZS " + Math.round(n).toLocaleString("en-TZ") : "TZS 0");

const TAG_CLASS = { allow: "s-tag-allow", hold: "s-tag-hold", block: "s-tag-block" };

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const AVATARS = ["var(--gradient-blue)", "linear-gradient(135deg,#2dd4bf 0%,#06b6d4 100%)", "linear-gradient(135deg,#f6b60c 0%,#ffd766 100%)"];

export default function Simulator() {
  const { creds } = useCredentials();
  const [customers, setCustomers] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [custErr, setCustErr] = useState(null);
  const [form, setForm] = useState(null);
  const [step, setStep] = useState("home");
  const [pin, setPin] = useState("");
  const [verify, setVerify] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [act, setAct] = useState("idle");
  const [disputeId, setDisputeId] = useState(null);
  const [actBusy, setActBusy] = useState(false);
  const [error, setError] = useState(null);
  const [txnRef, setTxnRef] = useState("");
  const freshRef = () => "SIM-" + Math.floor(Date.now() / 1000) + "-" + Math.floor(Math.random() * 900 + 100);

  useEffect(() => {
    (async () => {
      try {
        const [res, scRes] = await Promise.all([
          dcsRequest({
            baseUrl: creds.baseUrl,
            method: "GET",
            path: "/v1/sandbox/customers",
            opsToken: creds.opsToken,
          }),
          dcsRequest({
            baseUrl: creds.baseUrl,
            method: "GET",
            path: "/v1/sandbox/scenarios",
            opsToken: creds.opsToken,
          }),
        ]);
        if (res.status === 200 && res.body?.senders) {
          setCustomers(res.body);
          setTxnRef(freshRef());
          const first = res.body.senders[0];
          if (first) {
            setForm({
              sender: first.external_ref,
              recipient: res.body.recipients[0]?.external_ref || "",
              customRecipient: false,
              amount: first.typical_amount || 100000,
              device: first.known_devices?.[0] || first.external_ref + "-dev",
              night: false,
            });
          }
        } else {
          setCustErr("Haiwezi kupakia wateja (" + (res.status || "network") + ") — anza API ya DCS.");
        }
        if (scRes.status === 200 && Array.isArray(scRes.body?.scenarios)) {
          setScenarios(scRes.body.scenarios);
        }
      } catch (err) {
        setCustErr(String(err.message || err));
      }
    })();
  }, [creds]);

  const sender = useMemo(
    () => customers?.senders.find((s) => s.external_ref === form?.sender),
    [customers, form?.sender]
  );
  const recipient = useMemo(
    () => customers?.recipients.find((r) => r.external_ref === form?.recipient),
    [customers, form?.recipient]
  );

  const recipientFullName = useMemo(() => {
    if (recipient) return recipient.registered_name;
    if (verify?.recipient_display_name) return verify.recipient_display_name;
    return form?.recipient ? form.recipient : "";
  }, [recipient, verify, form]);

  const occurredAt = useMemo(() => {
    if (!form) return new Date().toISOString();
    const d = new Date();
    if (form.night) d.setHours(22, 0, 0, 0);
    return d.toISOString();
  }, [form]);

  const resetRun = () => {
    setError(null);
    setOutcome(null);
    setVerify(null);
    setAct("idle");
    setPin("");
    setTxnRef(freshRef());
    setStep("home");
  };

  async function confirmRecipient(ref) {
    setVerifying(true);
    setError(null);
    try {
      const res = await dcsRequest({
        baseUrl: creds.baseUrl,
        method: "POST",
        path: "/v1/recipients/verify",
        payload: {
          recipient_external_ref: form.recipient,
          channel: "mobile_money",
          tenant_txn_ref: ref || txnRef,
        },
        apiKey: creds.apiKey,
        signingSecret: creds.signingSecret,
      });
      setVerify(res.body);
      if (res.status !== 200) throw new Error(res.body?.message || "Ukaguzi wa mpokeaji umekosa.");
    } catch (err) {
      setError(String(err.message || err));
      setVerify(null);
    } finally {
      setVerifying(false);
    }
  }

  async function sendMoney() {
    setRunning(true);
    setError(null);
    try {
      const res = await dcsRequest({
        baseUrl: creds.baseUrl,
        method: "POST",
        path: "/v1/transactions/validate",
        payload: {
          tenant_txn_ref: txnRef,
          user_external_ref: form.sender,
          amount: Number(form.amount),
          currency: "TZS",
          channel: "mobile_money",
          recipient_external_ref: form.recipient,
          device_fingerprint: form.device,
          occurred_at: occurredAt,
        },
        apiKey: creds.apiKey,
        signingSecret: creds.signingSecret,
      });
      if (!res.body || (res.status !== 200 && res.status !== 201)) {
        throw new Error(res.body?.message || "Kosa la API (" + res.status + ")");
      }
      setOutcome(res.body);
      setStep("result");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setRunning(false);
    }
  }

  async function doRelease() {
    setActBusy(true);
    setError(null);
    try {
      const res = await dcsRequest({
        baseUrl: creds.baseUrl,
        method: "POST",
        path: "/v1/holds/" + outcome.hold.hold_id + "/release",
        payload: { released_by: "customer", note: "Sandbox: mteja amethibitisha sahihi" },
        apiKey: creds.apiKey,
        signingSecret: creds.signingSecret,
      });
      if (res.status !== 200) throw new Error(res.body?.message || "Imekosa kuruhusu.");
      setAct("released");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setActBusy(false);
    }
  }

  async function doFreeze() {
    setActBusy(true);
    setError(null);
    try {
      const res = await dcsRequest({
        baseUrl: creds.baseUrl,
        method: "POST",
        path: "/v1/holds/" + outcome.hold.hold_id + "/freeze",
        payload: {},
        opsToken: creds.opsToken,
      });
      if (res.status !== 200) throw new Error(res.body?.message || "Freeze imekosa.");
      setAct("frozen");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setActBusy(false);
    }
  }

  async function doDispute() {
    setActBusy(true);
    setError(null);
    try {
      const res = await dcsRequest({
        baseUrl: creds.baseUrl,
        method: "POST",
        path: "/v1/disputes",
        payload: {
          hold_id: outcome.hold.hold_id,
          reason: "Sikujua huyu mpokeaji — TZ Risala ya fedha (Consumer Protection). Narejesha ovyo fedha.",
        },
        apiKey: creds.apiKey,
        signingSecret: creds.signingSecret,
      });
      if (res.status !== 201) throw new Error(res.body?.message || "Ripoti haikuweza kuwasilishwa.");
      setDisputeId(res.body.dispute_id);
      setAct("disputed");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setActBusy(false);
    }
  }

  async function doResolve() {
    setActBusy(true);
    setError(null);
    try {
      const res = await dcsRequest({
        baseUrl: creds.baseUrl,
        method: "PATCH",
        path: "/v1/disputes/" + disputeId,
        payload: { outcome: "approved", note: "Ulaghai umethibitishwa — rejesha fedha kwa mwenye akaunti." },
        opsToken: creds.opsToken,
      });
      if (res.status !== 200) throw new Error(res.body?.message || "Uamuzi haukupokelewa.");
      setAct("resolved");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setActBusy(false);
    }
  }

  const journey = useMemo(() => {
    const steps = [];
    steps.push({ id: "customer", status: "done", icon: "fa-solid fa-user", sw: "Mteja: " + (sender ? sender.display_name : form?.sender), en: "wallet opened with real balance" });
    if (verify) {
      steps.push({
        id: "recipient",
        status: "done",
        icon: "fa-solid fa-magnifying-glass",
        sw: "Mpokeaji: " + (recipientFullName) + " — siku " + (verify.account_age_days ?? "?"),
        en: verify.verified ? "registered name confirmed" : "NOT in registry — you confirm yourself",
      });
    }
    if (outcome) {
      steps.push({ id: "sign", status: "done", icon: "fa-solid fa-signature", sw: "Sahihi ya HMAC-SHA256 imeambatishwa", en: "request signed + timestamped" });
      steps.push({
        id: "score",
        status: "done",
        icon: "fa-solid fa-chart-line",
        sw: "Alama ya hatari: " + (typeof outcome.risk_score === "number" ? outcome.risk_score.toFixed(1) : "—") + "/100",
        en: (outcome.reason_codes?.length ? outcome.reason_codes.join(" · ") : "no signals fired"),
      });
      steps.push({ id: "decision", status: outcome.decision === "block" ? "blocked" : "done", icon: "fa-solid fa-gavel", sw: "Uamuzi: " + outcome.decision.toUpperCase(), en: "decision engine v" + outcome.model_version });

      if (outcome.decision === "hold" && outcome.hold) {
        const holdState = resolveHoldState(act);
        steps.push({
          id: "hold",
          status: "done",
          icon: "fa-solid fa-vault",
          sw: "Pesa zimehifadhiwa (" + holdState + ")",
          en: "hold " + outcome.hold.hold_id + " · TTL dakika 30",
        });
        if (act === "released") {
          steps.push({ id: "go", status: "done", icon: "fa-solid fa-check", sw: "Mteja amethibitisha — pesa zimeendelea kwa mpokeaji", en: "release approved by customer" });
        }
        if (act === "frozen" || act === "disputed" || act === "resolved") {
          steps.push({ id: "freeze", status: "done", icon: "fa-solid fa-lock", sw: "Ops wamefungia pesa (freeze)", en: "funds frozen pending investigation" });
        }
        if (act === "disputed" || act === "resolved") {
          steps.push({ id: "dispute", status: "done", icon: "fa-solid fa-file-shield", sw: "Ripoti ya ulaghai imewasilishwa", en: "complaint filed · SLA 48h" });
        }
        if (act === "resolved") {
          steps.push({ id: "refund", status: "done", icon: "fa-solid fa-rotate-left", sw: "Pesa zimerudishwa kwa mwenye akaunti", en: "refund to sender approved" });
        }
      }
      if (outcome.decision === "block") {
        steps.push({ id: "stopped", status: "blocked", icon: "fa-solid fa-ban", sw: "Imesitishwa — pesa hazikutoka nje", en: "transfer blocked before settling" });
      }
    }
    return steps;
  }, [sender, form, verify, outcome, act, recipientFullName]);

  const sms = useMemo(() => {
    if (!outcome) return null;
    const time = new Date(occurredAt).toLocaleTimeString("en-TZ", { hour: "2-digit", minute: "2-digit" });
    const rName = recipientFullName;
    const amt = nf(Number(form?.amount));
    if (outcome.decision === "allow") {
      return {
        tone: "ok",
        brand: "DCS-WALLET",
        time,
        body: `TZS ${Number(form?.amount).toLocaleString("en-TZ")}.00 zimepelekwa kwa ${rName}.\nRef: ${outcome.transaction_id}\nOnyo la hatari: HAKUNA (score ${outcome.risk_score}).`,
      };
    }
    if (outcome.decision === "warn") {
      return {
        tone: "warn",
        brand: "DCS-WALLET",
        time,
        body: `TZS ${Number(form?.amount).toLocaleString("en-TZ")}.00 zimefika kwa ${rName}.\nLakini mfumo umeona ishara: ${(outcome.reason_codes || []).join(", ")}.\nHakikisha ulipeleka sahihi. Piga simu 100 kama si wewe.`,
      };
    }
    if (outcome.decision === "block") {
      return {
        tone: "block",
        brand: "DCS-WALLET",
        time,
        body: `Tuma ya ${amt} kwa ${rName} imesitishwa.\nIshara za hatari: ${(outcome.reason_codes || []).join(", ")}.\nPesa zako hazikutoka nje. Simu 100 kwa usaidizi.\nRef: ${outcome.transaction_id}`,
      };
    }
    if (act === "idle") {
      return {
        tone: "hold",
        brand: "DCS-WALLET",
        time,
        body: `${amt} zimehifadhiwa (salama) kwa ${rName}.\nHatari: ${(outcome.reason_codes || []).join(", ")}.\n1. Sahihi? Bonyeza “Nathibitisha”.\n2. Si wewe? Piga 100 — pesa zitarejeshwa.`,
      };
    }
    if (act === "released") {
      return {
        tone: "ok",
        brand: "DCS-WALLET",
        time,
        body: `Umehakikisha. ${amt} zimefika kwa ${rName}.\nRef: ${outcome.transaction_id}\nAsante kwa uthibitisho wa haraka.`,
      };
    }
    if (act === "resolved") {
      return {
        tone: "refund",
        brand: "DCS-WALLET",
        time,
        body: `Ripoti Y-${disputeId || "…"} imekamilika.\nUchunguzi wa Ops umethibitisha: huyu si mtumiaji wako.\n${amt} zimerejeshwa kwako (refund).\nPesa zako zinalindwa.`,
      };
    }
    return {
      tone: "hold",
      brand: "DCS-WALLET",
      time,
      body: `${amt} zimesalia kwenye hold ya ${outcome.hold?.hold_id}.\nUchunguzi unaendelea...`,
    };
  }, [outcome, verify, form, act, occurredAt, recipientFullName]);

  return (
    <section className="section-pad">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Sandbox ya simu — jaribu mwenyewe</span>
          <h2>Tuma pesa kama katika app ya benki</h2>
          <p>
            Hii ni sandbox kama app ya kifedha (uproad tayari umeona): fungua pochi, salio la kweli kutoka kwenye
            hifadhidata, chagua mpokeaji kwenye kitabu cha simu, weka kiasi — kisha DCS inakagua jina, inakokotoa
            hatari na inaamua <b className="mono">allow · warn · hold · block</b>. Ukikosea namba, utaona kabla ya pesa kutoka.
          </p>
        </div>

        <div className="cred-bar">
          <span className="dot" />
          <span>
            Kurusha maombi yaliyosainiwa (HMAC-SHA256) kwenda <b className="mono">{creds.baseUrl}</b> kama{" "}
            <b className="mono">{creds.apiKey}</b> · Ops token kwa freeze/dispute/refund.
          </span>
        </div>

        {custErr && (
          <div className="result">
            <div className="banner banner-danger">
              <i className="fa-solid fa-circle-exclamation" /> {custErr}
            </div>
          </div>
        )}

        <div className="sandbox-grid mt">
          {/* ============ PHONE ============ */}
          <div className="phone">
            <div className="phone-screen">
              <div className="phone-notch">
                <span>DCS-SAFE</span>
                <span>•••••</span>
              </div>
              <div className="phone-header">
                <div className="phone-logo">D</div>
                <div className="phone-title">
                  DCS <b>Wallet</b>
                </div>
                <span className="phone-sub">SANDBOX</span>
              </div>

              <div className="phone-body">
                {!form || !customers ? (
                  <div className="app-step">
                    <div className="app-step-body">
                      <div className="muted" style={{ fontSize: 13, padding: "18px 4px" }}>
                        <span className="spinner" /> Inapakia pochi ya sandbox...
                      </div>
                    </div>
                  </div>
                ) : step === "home" ? (
                  <WalletHome form={form} sender={sender} setForm={setForm} senders={customers.senders} next={() => setStep("recipient")} />
                ) : step === "recipient" ? (
                  <PhoneBook recipients={customers.recipients} form={form} setForm={setForm} back={() => setStep("home")} next={() => setStep("amount")} />
                ) : step === "amount" ? (
                  <AmountStep form={form} sender={sender} recipient={recipient} setForm={setForm} back={() => setStep("recipient")} next={() => setStep("pin")} />
                ) : step === "pin" ? (
                  <StepPin pin={pin} setPin={setPin} back={() => setStep("amount")} next={() => { const ref = freshRef(); setTxnRef(ref); setStep("confirm"); confirmRecipient(ref); }} />
                ) : step === "confirm" ? (
                  <StepConfirm form={form} sender={sender} recipient={recipient} recipientFullName={recipientFullName} verify={verify} verifying={verifying} txnRef={txnRef} occurredAt={occurredAt} running={running} back={() => setStep("pin")} send={sendMoney} />
                ) : (
                  <ResultBody outcome={outcome} sender={sender} recipient={recipient} recipientFullName={recipientFullName} form={form} act={act} actBusy={actBusy}
                    doRelease={doRelease} doFreeze={doFreeze} doDispute={doDispute} doResolve={doResolve}
                    reset={resetRun} />
                )}

                {error && (
                  <div className="banner banner-danger" style={{ margin: 0 }}>
                    <i className="fa-solid fa-circle-exclamation" /> {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ============ JOURNEY + SMS ============ */}
          <div className="card" style={{ marginTop: 0 }}>
            <h3>
              <i className="fa-solid fa-route" style={{ color: "var(--gold)" }} /> Safari ya pesa zako
            </h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Kila hatua inaonyeshwa. Ukiona <b className="mono" style={{ color: "#fbbf24" }}>hold</b> au{" "}
              <b className="mono" style={{ color: "#f87171" }}>block</b>, pesa hazitoki nje — DCS inazilinda.
            </p>

            {journey.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>Subiri — safari itaonekana hapa ukichagua mteja na kutuma.</p>
            ) : (
              <ul className="journey">
                {journey.map((s) => (
                  <li key={s.id} className={s.status === "blocked" ? "blocked" : s.status}>
                    <div className="journey-ico">
                      <i className={s.icon} />
                    </div>
                    <div className="journey-body">
                      <div className="j-title">{s.sw}</div>
                      <div className="j-en">{s.en}</div>
                      {s.id === "score" && outcome?.reason_codes?.length > 0 && (
                        <div className="j-extra">
                          {outcome.reason_codes.map((c) => (
                            <span key={c} className={"chip " + (outcome.decision === "block" ? "chip-danger" : outcome.decision === "hold" ? "chip-warning" : c.includes("TRUST") || c.includes("BLOCK") ? "chip-danger" : "chip-warning")} style={{ margin: "4px 6px 0 0" }}>
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {sms && (
              <>
                <h3 className="muted" style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", margin: "24px 0 10px", color: "var(--muted)" }}>
                  <i className="fa-solid fa-message" style={{ color: "var(--blue-2)", marginRight: 6 }} /> Ujumbe SMS kama utapokea
                </h3>
                <div className="sms">
                  <div className="sms-head">
                    <i className="fa-solid fa-sim-card" style={{ color: "var(--gold)" }} />
                    <span className="who">{sms.brand}</span>
                    {act === "resolved" ? <span className="chip chip-danger" style={{ fontSize: 9 }}>REFUND</span> : outcome?.decision === "allow" ? <span className="chip chip-neutral" style={{ fontSize: 9, color: "#34d399" }}>SUCCESS</span> : null}
                    <span className="time">{sms.time}</span>
                  </div>
                  {sms.body.split("\n").map((l, i) => <p key={i}>{l}</p>)}
                </div>
              </>
            )}

            {outcome?.decision === "warn" && outcome?.advisory && (
              <div className="banner banner-info" style={{ marginTop: 18 }}>
                <i className="fa-solid fa-circle-info" /> {outcome.advisory.message}
              </div>
            )}
          </div>
        </div>

        {/* ============ SCENARIOS ============ */}
        <h3 style={{ margin: "44px 0 4px" }}>
          <i className="fa-solid fa-book-open" style={{ color: "var(--gold)" }} /> Hadithi tatu za kujaribu (bofya Jaribu)
        </h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 22 }}>
          Kila hadithi inachagua wateja na hali halisi ya kitaalam ili uone matokeo — kisha uweke PIN yoyote (mfano 1234) na uthibitishe.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 20 }}>
          {scenarios.map((sc) => {
            const p = sc.preset || {};
            const device =
              p.device_unknown
                ? "device-unknown-01"
                : customers?.senders.find((s) => s.external_ref === p.sender)?.known_devices?.[0] || "device-unknown-01";
            return (
              <div className="scenario" key={sc.key}>
                <h4>
                  <i className={sc.key === "a" ? "fa-solid fa-hand-holding-dollar" : sc.key === "b" ? "fa-solid fa-shield-halved" : "fa-solid fa-ban"} style={{ color: "var(--gold-2)" }} /> {sc.title}
                  <span className={"s-tag " + (TAG_CLASS[sc.expected_decision] || "s-tag-allow")}>{sc.tag}</span>
                </h4>
                <p>{sc.description}</p>
                <div className="flow">{sc.flow}</div>
                <button
                  className="phone-btn phone-btn-gold"
                  style={{ padding: "11px" }}
                  disabled={!form}
                  onClick={() => {
                    setForm((prev) => ({ ...prev, sender: p.sender, recipient: p.recipient, customRecipient: false, amount: p.amount ?? 100000, device, night: Boolean(p.night) }));
                    setError(null);
                    setVerify(null);
                    setPin("");
                    setTxnRef(freshRef());
                    setStep("pin");
                  }}
                >
                  <i className="fa-solid fa-play" /> Jaribu hadithi hii
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WalletHome({ form, sender, setForm, senders, next }) {
  return (
    <div className="app-step">
      <div className="app-step-top">
        <span className="app-step-n done">1</span>
        <div>
          <div className="app-step-title">Pochi yako</div>
          <div className="app-step-en">wallet — real balance from the sandbox DB</div>
        </div>
      </div>
      <div className="app-step-body">
        <select className="phone-select" value={form.sender} onChange={(e) => setForm((f) => ({ ...f, sender: e.target.value, amount: (senders.find((s) => s.external_ref === e.target.value)?.typical_amount) || f.amount }))}>
          {senders.map((s) => (
            <option key={s.external_ref} value={s.external_ref}>
              {s.registered_name} · {s.external_ref}
            </option>
          ))}
        </select>

        <div className="wallet-hero">
          <div className="w-row">
            <span className="w-ico"><i className="fa-solid fa-wallet" /></span>
            <span className="w-meta">
              <span className="w-label">Salio lako</span>
              <span className="w-name">{sender?.registered_name}</span>
            </span>
            <span className="w-ccy">TZS</span>
          </div>
          <div className="w-balance">{nf(sender?.balance ?? 0)}</div>
          <div className="w-sub">Pochi ya DCS · siku {sender?.account_age_days}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <div className="action-tile">
            <i className="fa-solid fa-phone-volume" />
            <span>Lipia</span>
            <small>pochi & beki</small>
          </div>
          <div className="action-tile">
            <i className="fa-solid fa-down-left-and-up-right-to-center" />
            <span>Pokea</span>
            <small>namba yako</small>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 11.5, margin: "8px 2px 0", lineHeight: 1.5 }}>
          {sender?.note}
        </p>
        <button className="phone-btn phone-btn-gold" style={{ marginTop: 14 }} onClick={next}>
          <i className="fa-solid fa-paper-plane" /> Tuma pesa
        </button>
      </div>
    </div>
  );
}

function PhoneBook({ recipients, form, setForm, back, next }) {
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState(false);
  const [manual, setManual] = useState("");
  const filtered = recipients.filter((r) =>
    (r.registered_name || "").toLowerCase().includes(q.toLowerCase()) || r.external_ref.includes(q)
  );
  return (
    <div className="app-step">
      <div className="app-step-top">
        <span className="app-step-n done">2</span>
        <div>
          <div className="app-step-title">Chagua mpokeaji</div>
          <div className="app-step-en">phone book — contacts from the sandbox DB</div>
        </div>
      </div>
      <div className="app-step-body">
        <input className="phone-input" style={{ marginTop: 0 }} type="search" placeholder="Tafuta jina au namba..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {filtered.map((r, i) => (
            <button className="contact" key={r.external_ref} onClick={() => { setForm((f) => ({ ...f, recipient: r.external_ref, customRecipient: false })); next(); }}>
              <span className="c-ava" style={{ background: AVATARS[i % AVATARS.length] }}>{initials(r.registered_name)}</span>
              <span className="c-body">
                <span className="c-name">{r.registered_name}</span>
                <span className="c-sub">{r.external_ref} · akaunti ya siku {r.account_age_days}</span>
              </span>
              <i className="fa-solid fa-chevron-right c-go" />
            </button>
          ))}
          <button className="contact contact-new" onClick={() => setCustom((v) => !v)}>
            <span className="c-ava" style={{ background: "var(--gradient-gold)", color: "#06101f" }}><i className="fa-solid fa-plus" /></span>
            <span className="c-body">
              <span className="c-name">Namba nyingine mpya</span>
              <span className="c-sub">sio kwenye kitabu — ingiza wewe</span>
            </span>
            <i className="fa-solid fa-chevron-down c-go" />
          </button>
          {custom && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="phone-input" type="tel" inputMode="numeric" placeholder="mfano 255777000000" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))} />
              <p className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
                Namba mpya haikatiliwi moja kwa moja — DCS itaangalia jina, na ukithibitisha mwenyewe pesa zitatumwa.
              </p>
              <button className="phone-btn phone-btn-gold" disabled={manual.replace(/\D/g, "").length < 8} onClick={() => { setForm((f) => ({ ...f, recipient: manual.replace(/\D/g, ""), customRecipient: true })); next(); }}>
                Endelea na namba hii <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          )}
        </div>
        <button className="phone-btn phone-btn-ghost" style={{ marginTop: 12 }} onClick={back}>
          <i className="fa-solid fa-arrow-left" /> Nyuma
        </button>
      </div>
    </div>
  );
}

function AmountStep({ form, sender, recipient, setForm, back, next }) {
  const knownDevices = (sender?.known_devices || []).filter(Boolean);
  const amount = Number(form.amount) || 0;
  const quicks = [10000, 50000, 100000, 300000, sender?.typical_amount ? Number(sender.typical_amount) : null].filter((v, i, a) => v && a.indexOf(v) === i);
  return (
    <div className="app-step">
      <div className="app-step-top">
        <span className="app-step-n done">3</span>
        <div>
          <div className="app-step-title">Weka kiasi</div>
          <div className="app-step-en">amount — full recipient name before sending</div>
        </div>
      </div>
      <div className="app-step-body">
        <TransferCard
          sender={sender}
          recipient={recipient}
          amount={form.amount}
          showAmount
        />
        <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, display: "block", marginTop: 12 }}>Kiasi (TZS)</label>
        <input className="phone-input" style={{ marginTop: 6 }} type="number" min={1} max={sender?.balance || undefined} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {quicks.map((v) => (
            <button key={v} className={"phone-btn quick-chip " + (amount === v ? "quick-on" : "phone-btn-ghost")} style={{ padding: "7px 10px", width: "auto", fontSize: 11.5 }} onClick={() => setForm((f) => ({ ...f, amount: v }))}>
              {nf(v)}
            </button>
          ))}
        </div>

        <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, display: "block", marginTop: 12 }}>Simu yako (device)</label>
        <select className="phone-select" style={{ marginTop: 6 }} value={form.device} onChange={(e) => setForm((f) => ({ ...f, device: e.target.value }))}>
          {knownDevices.map((d) => (
            <option key={d} value={d}>Simu inayojulikana · {d}</option>
          ))}
          <option value="device-unknown-01">⟨ Kifaa kipya (hakitambuliki) ⟩</option>
        </select>

        <label className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, display: "block", marginTop: 12 }}>Muda</label>
        <select className="phone-select" style={{ marginTop: 6 }} value={form.night ? "night" : "now"} onChange={(e) => setForm((f) => ({ ...f, night: e.target.value === "night" }))}>
          <option value="now">Sasa hivi</option>
          <option value="night">Usiku (22:00)</option>
        </select>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="phone-btn phone-btn-ghost" style={{ width: "auto", flex: 1 }} onClick={back}>
            <i className="fa-solid fa-arrow-left" /> Nyuma
          </button>
          <button className="phone-btn phone-btn-gold" style={{ width: "auto", flex: 2 }} disabled={!amount || amount <= 0} onClick={next}>
            Endelea <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferCard({ sender, recipient, recipientFullName, amount, decision, showAmount }) {
  const rName = recipientFullName || recipient?.registered_name || "Mpokeaji";
  return (
    <div className="transfer">
      <div className="t-side">
        <span className="t-ava" style={{ background: "var(--gradient-blue)" }}>{initials(sender?.registered_name)}</span>
        <span className="t-name">{sender?.registered_name || "Wewe"}</span>
        <span className="t-sub">ANAYETUMA</span>
      </div>
      <div className="t-mid">
        {showAmount && amount ? <span className="t-amount">{nf(Number(amount))}</span> : <span className="t-arrow"><i className="fa-solid fa-arrow-right" /></span>}
        {decision && <DecisionBadge decision={decision} />}
      </div>
      <div className="t-side">
        <span className="t-ava" style={{ background: "var(--gradient-gold)", color: "#06101f" }}>{initials(rName)}</span>
        <span className="t-name">{rName}</span>
        <span className="t-sub">ANAYEPOKEA · {recipient?.external_ref || "namba mpya"}</span>
      </div>
    </div>
  );
}

function StepPin({ pin, setPin, back, next }) {
  const poke = (d) => {
    if (pin.length >= 4) return;
    setPin(pin + d);
  };
  return (
    <div className="app-step">
      <div className="app-step-top">
        <span className="app-step-n done">4</span>
        <div>
          <div className="app-step-title">Weka PIN yako</div>
          <div className="app-step-en">enter your PIN (sandbox: yoyote)</div>
        </div>
      </div>
      <div className="app-step-body">
        <div className="pin-dots">
          {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? "filled" : ""} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, margin: "6px 0 12px" }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} className="phone-btn phone-btn-ghost" style={{ padding: 12 }} onClick={() => poke(d)}>{d}</button>
          ))}
          <button className="phone-btn phone-btn-ghost" style={{ padding: 12 }} onClick={() => setPin("")}><i className="fa-solid fa-rotate-left" /></button>
          <button className="phone-btn phone-btn-ghost" style={{ padding: 12 }} onClick={() => poke("0")}>0</button>
          <button className="phone-btn phone-btn-ghost" style={{ padding: 12 }} onClick={() => setPin((p) => p.slice(0, -1))}><i className="fa-solid fa-delete-left" /></button>
        </div>
        <p className="muted" style={{ fontSize: 11, textAlign: "center", margin: "0 0 12px" }}>
          Sandbox: PIN yoyote ya tarakimu 4 inakubaliwa (mfano 1234).
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="phone-btn phone-btn-ghost" style={{ width: "auto", flex: 1 }} onClick={back}><i className="fa-solid fa-arrow-left" /></button>
          <button className="phone-btn phone-btn-gold" style={{ flex: 2 }} disabled={pin.length < 4} onClick={next}>
            Endelea <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepConfirm({ form, sender, recipient, recipientFullName, verify, verifying, txnRef, occurredAt, running, back, send }) {
  return (
    <div className="app-step">
      <div className="app-step-top">
        <span className="app-step-n done">5</span>
        <div>
          <div className="app-step-title">Hakikisha umemtuma sahihi</div>
          <div className="app-step-en">confirm — like “Hakikisha” in real apps</div>
        </div>
      </div>
      <div className="app-step-body">
        <TransferCard sender={sender} recipient={recipient} recipientFullName={recipientFullName} amount={form.amount} showAmount />

        {verifying ? (
          <div className="muted" style={{ textAlign: "center", fontSize: 12 }}><span className="spinner" /> Inakagua jina la mpokeaji...</div>
        ) : verify ? (
          <div className="recipient-confirm" style={{ marginTop: 12 }}>
            <div className="small">
              {form.customRecipient ? "Namba mpya (sio kitabu)" : "Mpokeaji:"}{" "}
              <b style={{ color: "#fff" }}>{recipientFullName}</b>
            </div>
            <div className="small">
              {form.recipient} · akaunti ya siku {verify.account_age_days ?? "?"} · {verify.verified ? "imeandikwa kwenye daftari rasmi ✓" : "HAIPO kwenye daftari rasmi"}
            </div>
            {verify.first_time_recipient && (
              <div className="warn-line">
                <i className="fa-solid fa-triangle-exclamation" /> Kwanza kabisa kumtumia mtu huyu — hakikisha sana!
              </div>
            )}
            {!verify.verified && (
              <div className="warn-line">
                <i className="fa-solid fa-triangle-exclamation" /> Namba hii haina jina lililosajiliwa — wewe ndiwe uthibitisho wa mwisho. Ukikosea, BONYEZA NYUMA usitume.
              </div>
            )}
            <div className="small" style={{ fontFamily: "var(--mono)", marginTop: 6 }}>ref {txnRef} · {new Date(occurredAt).toLocaleTimeString("en-TZ", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        ) : null}

        <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.6, textAlign: "center" }}>
          “Huyu ndiye unayemtumia?” — DCS inalinda pesa zako kukagua hii kabla zisitoke.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="phone-btn phone-btn-ghost" style={{ width: "auto", flex: 1 }} disabled={running} onClick={back}>
            <i className="fa-solid fa-arrow-left" /> Badilisha
          </button>
          <button className="phone-btn phone-btn-gold" style={{ flex: 2 }} disabled={running || verifying || !verify} onClick={send}>
            {running ? <span className="spinner" /> : <i className="fa-solid fa-paper-plane" />} Thibitisha & Tuma
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultBody({ outcome, form, sender, recipient, recipientFullName, act, actBusy, doRelease, doFreeze, doDispute, doResolve, reset }) {
  if (!outcome) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="app-step">
        <div className="app-step-body" style={{ paddingTop: 14 }}>
          <TransferCard sender={sender} recipient={recipient} recipientFullName={recipientFullName} amount={form.amount} showAmount decision={outcome.decision} />
          <p className="muted" style={{ fontSize: 11.5, textAlign: "center", margin: "10px 0 0" }}>
            Alama ya hatari: <b>{outcome.risk_score?.toFixed(1) ?? "—"}/100</b> · {outcome.reason_codes?.length ? outcome.reason_codes.join(" · ") : "hakuna ishara"}
          </p>

          {outcome.decision === "allow" && (
            <p style={{ fontSize: 12.5, color: "#86efac", lineHeight: 1.6, margin: "10px 0 0" }}>
              <i className="fa-solid fa-circle-check" /> Pesa zimepelekwa — mpokeaji anajulikana, hakuna hatari. Salama.
            </p>
          )}
          {outcome.decision === "warn" && (
            <p style={{ fontSize: 12.5, color: "#fbbf24", lineHeight: 1.6, margin: "10px 0 0" }}>
              <i className="fa-solid fa-circle-info" /> Pesa zimefika lakini mfumo umetahadharisha. Hakikisha ulikuwa sahihi.
            </p>
          )}
          {outcome.decision === "block" && (
            <p style={{ fontSize: 12.5, color: "#fda4af", lineHeight: 1.6, margin: "10px 0 0" }}>
              <i className="fa-solid fa-ban" /> Imesitishwa — hatari kubwa. Pesa hazikutoka nje ya akaunti yako.
            </p>
          )}
          {outcome.decision === "hold" && (
            <p style={{ fontSize: 12.5, color: "#fb923c", lineHeight: 1.6, margin: "10px 0 0" }}>
              <i className="fa-solid fa-vault" /> Pesa zimehifadhiwa (halisi). Chagua: sahihi & peleka, au ripoti na urudishwe.
            </p>
          )}

          {act === "idle" && outcome.decision === "hold" && (
            <>
              <button className="phone-btn phone-btn-green" style={{ marginTop: 12 }} disabled={actBusy} onClick={doRelease}>
                <i className="fa-solid fa-check" /> Sahihi — nathibitisha, peleka pesa
              </button>
              <button className="phone-btn phone-btn-danger" style={{ marginTop: 8 }} disabled={actBusy} onClick={doFreeze}>
                <i className="fa-solid fa-triangle-exclamation" /> Hii SI mtu wangu — ripoti (Simu 100)
              </button>
            </>
          )}

          {act === "frozen" && (
            <>
              <p style={{ fontSize: 12.5, color: "#fda4af", lineHeight: 1.6, margin: "10px 0 0" }}>
                <i className="fa-solid fa-lock" /> Ops wamefungia pesa (freeze). Sasa wasilisha ripoti rasmi.
              </p>
              <button className="phone-btn phone-btn-danger" style={{ marginTop: 12 }} disabled={actBusy} onClick={doDispute}>
                <i className="fa-solid fa-file-shield" /> Wasilisha ripoti ya ulaghai
              </button>
            </>
          )}

          {act === "disputed" && (
            <>
              <p style={{ fontSize: 12.5, color: "#7dd3fc", lineHeight: 1.6, margin: "10px 0 0" }}>
                <i className="fa-solid fa-hourglass-half" /> Ripoti imewasilishwa (SLA: uchunguzi ndani ya 48h). Ops wanachunguza...
              </p>
              <button className="phone-btn phone-btn-gold" style={{ marginTop: 12 }} disabled={actBusy} onClick={doResolve}>
                <i className="fa-solid fa-gavel" /> Ops: Thibitisha — rudisha pesa kwa mmiliki
              </button>
            </>
          )}

          {act === "released" && (
            <p style={{ fontSize: 12.5, color: "#86efac", lineHeight: 1.6, marginTop: 10 }}>
              <i className="fa-solid fa-circle-check" /> Umehakikisha — pesa zimeendelea kwa mpokeaji. Asante!
            </p>
          )}
          {act === "resolved" && (
            <p style={{ fontSize: 12.5, color: "#86efac", lineHeight: 1.6, marginTop: 10 }}>
              <i className="fa-solid fa-sack-dollar" /> Ripoti imekamilika — <b>{nf(Number(form?.amount))}</b> zimerudishwa kwenye akaunti yako.
            </p>
          )}

          <button className="phone-btn phone-btn-ghost" style={{ marginTop: 12 }} onClick={reset}>
            <i className="fa-solid fa-rotate-left" /> Anza upya
          </button>
        </div>
      </div>
    </div>
  );
}

function resolveHoldState(act) {
  if (act === "released") return "released";
  if (act === "resolved") return "refunded";
  if (act === "disputed") return "investigating";
  if (act === "frozen") return "frozen";
  return "active · salama";
}