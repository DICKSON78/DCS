# Digital Consumer Shield (DCS)

A real-time API for **recipient verification**, **fraud detection** and **transaction hold / freeze / block** for Tanzania's payment corridors — banks, mobile money operators (MNOs), GePG and TIPS.

DCS sits in front of a payment gateway and answers a single question on every transfer before money settles: **is this transaction safe to let through?**

---

## Why DCS exists

Real money is lost in Tanzanian payments through preventable gaps:

| Money-loss pattern | DCS response |
|---|---|
| Wrong-number transfers (type a digit, money goes to a stranger) | `POST /v1/recipients/verify` returns the masked registered name **before** the send |
| Account takeover / SIM swap (stolen device sends funds) | `device_fingerprint` changes flagged as `DEVICE_CHANGE` |
| Rapid drain (many small transfers under monitoring radar) | `HIGH_TXN_VELOCITY` signal above 6 tx/hour |
| Mule accounts (new accounts receive-and-forward funds) | `COLD_START_CUSTOMER`, `MULTI_RECIPIENT_FUNNELING`, `VERY_YOUNG_RECIPIENT_ACCOUNT` |
| Replayed / tampered API calls inside the corridor | Per-request HMAC signature with timestamp + nonce → replay returns `409` |
| DCS itself being down (decision blackout) | Fail-policy circuit breaker: `fail_open` → allow, `fail_closed` → block |

---

## How it works

```
 Gateway                             DCS API
 ───────                              ───────
 1. Customer initiates transfer
 2. Gateway calls POST /v1/recipients/verify
    └─> DCS looks up registered name, masks it, returns account age
 3. Gateway shows customer the masked name
 4. On confirm, Gateway calls POST /v1/transactions/validate
    └─> DCS runs the rule engine against the customer's behavioral
        baseline (amount, time-of-day, device, recipients, velocity)
        and returns decision:
            allow   (< 25)  settle normally
            warn    (25-59) return advisory; gateway may still settle
            hold    (60-79) create hold (30 min TTL), notify via webhook
            block   (>= 80) reject the transfer
 5. Ops can freeze a hold, or a dispute is filed; audit trail is
    hash-chained and tamper-evident.
```

Every decision is persisted with its model version and reason codes for full auditability.

---

## Tech stack

- **Runtime:** Node.js 20 (ESM)
- **API:** Fastify 5
- **Validation:** Zod
- **Database:** PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`)
- **Security:** Helmet, constant-time key comparison, hashed PII, request signing, per-tenant isolation

---

## Getting started

### 1. Prerequisites
- Node.js 20+
- PostgreSQL 16 running locally

### 2. Install & configure

```bash
git clone https://github.com/DICKSON78/DCS.git
cd DCS/dcs-api
npm install
cp .env.example .env      # then set DATABASE_URL, PORT, OPS_BEARER_TOKEN
```

### 3. Database

```bash
npx prisma db push        # create schema from prisma/schema.prisma
npx prisma generate       # regenerate the Prisma client
npm run seed              # creates test tenants
```

For fresh deployments use the managed migrations instead:

```bash
npx prisma migrate deploy
```

### 4. Run

```bash
npm start                 # listens on http://localhost:8080
```

Interactive OpenAPI docs: **http://localhost:8080/docs**

---

## Test tenants (sandbox)

| Tenant | Tenant ID | API key | Signing secret | Fail policy |
|---|---|---|---|---|
| Test Bank | `tenant-test-0001` | `test-api-key-0001` | `test-signing-key-0001` | `fail_open` |
| Test MNO | `tenant-mno-0002` | `mno-api-key-0002` | `mno-signing-key-0002` | `fail_closed` |

Ops (internal) token: configured via `OPS_BEARER_TOKEN`.

---

## Authenticating and signing requests

Every request (except `/v1/health`, `/docs`, and the ops routes) carries the tenant key plus a request signature:

| Header | Purpose |
|---|---|
| `X-Tenant-Key` | Tenant API key (looked up by SHA-256) |
| `X-Timestamp` | Epoch milliseconds; rejected if outside a 5-minute window |
| `X-Nonce` | Unique per request; reuse → `409 replay_detected` |
| `X-Signature` | HMAC-SHA256 of `timestamp.method.path.query.body` signed with the tenant **signing secret** |

```bash
INPUT="${TS}.${METHOD}.${PATH}..${BODY}"
SIGNATURE=$(echo -n "$INPUT" | openssl dgst -sha256 -hmac "$SIGNING_SECRET" | awk '{print $NF}')
```

HTTP semantics: unsigned/stale/tampered → `401`; nonce replay → `409`; valid → normal response.

---

## API reference

Interactive docs are served at `/docs`. Summary:

| Method & Path | Purpose |
|---|---|
| `POST /v1/recipients/verify` | Verify recipient before send; returns masked name, account age, first-time flag |
| `POST /v1/transactions/validate` | Score a transaction; returns `allow/warn/hold/block` + reason codes |
| `GET  /v1/transactions/:id` | Fetch a decision by `transaction_id` |
| `POST /v1/holds/:id/release` | Ops — release a hold |
| `POST /v1/holds/:id/freeze` | Ops — freeze a hold (withhold funds) |
| `POST /v1/disputes` | File a dispute against a hold |
| `PATCH /v1/disputes/:id` | Ops — resolve a dispute (approved/rejected) |
| `POST /v1/webhooks/subscribe` | Register a callback URL for hold/dispute events |
| `GET  /v1/audit/verify/:tenantId` | Ops — verify audit-chain integrity |
| `GET  /v1/health` | Liveness + real p95/p99 SLA metrics + audit chain status |

Webhook events are delivered with an `X-DCS-Signature` HMAC header so callbacks can be verified.

---

## Fraud rule engine

Weighted scoring (`MODEL_VERSION`-tagged, per-customer behavioral baselines):

| Signal | Weight |
|---|---|
| Amount far above baseline (`>3x`) | +40 |
| Amount atypical (`2-3x`) | +30 |
| New/changed device (`DEVICE_CHANGE`) | +35 |
| High velocity (`>5` tx/hour) | +25 |
| Very young recipient account (`<7` days) | +20 |
| Night mobile-money channel | +15 |
| Multi-recipient funneling (`>5` distinct/day) | +15 |
| Cold-start customer (day 0) | +15 |
| New recipient / young account / new customer | +10 |

Decision bands: `allow <25`, `warn 25-59`, `hold 60-79`, `block >=80`. Holds auto-release after 30 minutes unless frozen or disputed. ML model replaces/augments the weighted rules in Phase 5.

---

## Reliability & security

- **Fail-policy circuit breaker** — tenant credentials cached in memory; if the DB is unreachable, `fail_open` tenants get `allow` and `fail_closed` tenants get `block` (both marked `degraded`) instead of a bare 500.
- **Hash-chained audit log** — every entry commits to the previous (`prev_hash`/`entry_hash`); any tampering breaks the chain and is detected by the ops verification endpoint.
- **Idempotency** — `X-Request-Id` is claimed before processing; concurrent duplicates get `409` without double-processing; DB-level `UNIQUE(tenant_id, tenant_txn_ref)` as a backstop.
- **Per-tenant isolation** — all queries scoped by `tenant_id`; cross-tenant access returns `404`.
- **PII protection** — recipient/user references are stored SHA-256 hashed (`h_…`); names are masked.
- **Rate limiting** — per-tenant token bucket (200 rps steady, 400 burst).
- **TTL cleanup** — expired nonces and idempotency records are pruned hourly.

---

## Testing

```bash
npm test                  # 28 tests: unit rule-engine tests + API integration tests
```

---

## Project documentation

- `DCS_Software_Requirements_Specification.docx` — the SRS
- `DCS_API_Reference-1.docx` — the API contract reference

---

## Author

**Dr. Mshindi Andrew Rwamuhuru**