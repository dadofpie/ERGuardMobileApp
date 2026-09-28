# ER Guard Mobile App Security and Connection Review

Review date: 2026-09-13 (Asia/Manila)

## Executive summary

The public mobile-to-API connection is live and correctly traverses an Express gateway to the Flask ticketing service. TLS, HSTS, bearer-token authorization, response cache controls, and server-side object ownership checks were present in the paths reviewed. Session tokens and handoff/reset tokens are hashed at rest, passwords use Werkzeug's password hasher, OTP generation uses `secrets`, SQL values are parameterized, and iOS App Transport Security rejects arbitrary cleartext loads.

No confirmed critical vulnerability was found. Release should nevertheless be blocked on three high-severity items: credentials and PII are transported in Expo Router parameters, public authentication endpoints lack per-IP abuse controls, and the deployed Express dependency tree contains known high-severity denial-of-service advisories. The live API certificate also expires on 2026-09-16 and needs immediate renewal confirmation.

The activation handoff is incomplete in source: its fallback URL path is 404, and the generated handoff token has no consumer in the public activation flow. A production database override could correct the path, but not the missing token exchange.

## Scope

- React Native/Expo client under `mobile/` (iOS, Android configuration, and web-capable code paths).
- Public Express gateway in `Medicare Plus Mobile App/medicareplus-api`.
- Flask ER Guard API and database adapter in `telegram-support-bot`.
- Live, read-only checks against `api.app.medicareplus.com.ph` and the source-configured fallback activation page. No account credentials or member records were used.

## High severity

### SEC-001 — Passwords, identity data, and Google ID tokens are placed in router parameters

- Location: `mobile/app/(public)/sign-up.tsx:79-90`, `mobile/app/(public)/verify-otp.tsx:14,27-40`, `mobile/app/(public)/sign-in.tsx:217-224`, `mobile/app/(public)/google-complete.tsx:15,46-57`.
- Evidence: signup passes email, full name, birthday, mobile number, and plaintext password through `router.push({ params: ... })`; Google completion passes `id_token` the same way and reads both with `useLocalSearchParams`.
- Impact: on web these values become URL/query state and can leak through browser history, copied URLs, analytics, crash reports, referrers, screenshots, or server logs. On native they remain in navigation state and development/debug tooling. A leaked password or Google ID token can enable account takeover during its useful lifetime; birthday/mobile/name leakage exposes member PII.
- Fix: hold the pending signup and Google credential in an in-memory, short-lived context/store that is cleared on completion, cancellation, background timeout, and error. Route only with a random opaque flow ID. Do not persist the password or ID token.
- Mitigation: disable web release until fixed; scrub navigation/crash analytics and enforce `Referrer-Policy: no-referrer` on any web deployment.
- False-positive notes: risk is lower if the product is guaranteed never to ship on web and navigation state is excluded from all diagnostics, but plaintext secrets still should not be used as route parameters.

### SEC-002 — Public auth endpoints are not rate-limited by client IP at the edge

- Location: `Medicare Plus Mobile App/medicareplus-api/api/er_guard.js:57-76`; `telegram-support-bot/app/er_guard_app_api.py:615-638,719-758,877-910,912-945`.
- Evidence: every public auth route is directly proxied. Password login limits only `erguard-app:login:<identifier>`; Google limits a caller-controlled email key; forgot/reset password have no dedicated per-IP or per-account throttle. The provider-key quota is shared by all users and is not a substitute for client abuse controls.
- Impact: attackers can password-spray across many accounts, deliberately lock individual members out after five failures, submit large volumes of invalid reset attempts, or email-bomb known users. The shared upstream API-key quota can also let one abusive client degrade service for everyone.
- Fix: add a production rate limiter at the Express/nginx edge using trusted `req.ip`, with separate IP + normalized-account buckets for login, Google auth/complete, forgot/reset, signup verification, card linking, claims, and purchases. Return `429` with `Retry-After`; add alerting and tests. Preserve the existing account-level controls as defense in depth.
- Mitigation: deploy WAF rules for the auth prefix and monitor `401`, `409`, and `429` spikes.
- False-positive notes: an unreviewed nginx/WAF policy may already provide some protection. No such route-specific policy was visible in the reviewed repositories, so it must be verified in production configuration.

### SEC-003 — Express gateway has known remotely triggerable DoS advisories

- Location: `Medicare Plus Mobile App/medicareplus-api/package.json:18-25` and its lockfile.
- Evidence: `npm audit --omit=dev` reported 2 high, 2 moderate, and 1 low vulnerabilities. Installed versions include `express@4.21.0`, `path-to-regexp@0.1.10`, `qs@6.13.0`, `body-parser@1.20.3`, and `cookie@0.6.0`. High findings include `GHSA-rhx6-c78j-4q9w` and `GHSA-37ch-88jc-xwx2` in `path-to-regexp`.
- Impact: crafted requests can consume excessive CPU or memory and reduce availability of the public mobile API.
- Fix: upgrade Express and regenerate the lockfile to versions for which `npm audit --omit=dev` is clean, then run route regression tests. Do not use `npm audit fix --force` without reviewing the resulting major-version changes.
- Mitigation: enforce nginx request-rate, URI-length, query-count, header-size, and body-size limits.
- False-positive notes: exploitability varies by route shape, but the gateway is internet-facing and should not retain known high-severity request-parser/route-matcher advisories.

## Medium severity

### SEC-004 — Biometric session is not cryptographically bound to biometric authentication, and logout preserves it

- Location: `mobile/lib/session.ts:48-58`; `mobile/providers/auth-provider.tsx:179-202,216-265`; `telegram-support-bot/app/er_guard_app_db.py:258-293`.
- Evidence: `expo-secure-store` stores a second 30-day bearer token without `requireAuthentication: true` or an explicit device-only accessibility class. App-level code prompts biometrics before reading it, but the Keychain/Keystore item itself is not access-controlled by biometrics. When biometrics is enabled, sign-out skips the server logout call and intentionally leaves this token active.
- Impact: local code execution, device compromise, insecure backup/migration behavior, or an unlocked-device attacker may recover a bearer token that remains valid for up to 30 days. The UI says sign-out while the server session is deliberately retained.
- Fix: use a dedicated SecureStore item with `requireAuthentication: true` and an appropriate device-only accessibility setting; test biometric enrollment changes. Prefer a short-lived access token plus a rotating, revocable refresh credential. Rename the current action to “Lock” if it retains a session, and provide a true “Sign out” that always revokes and deletes every credential.
- Mitigation: shorten the current session TTL and expose server-side session/device management.
- False-positive notes: SecureStore still provides meaningful OS-backed protection; this finding concerns the missing biometric binding and long-lived logout semantics, not plaintext disk storage.

### SEC-005 — Signup responses disclose whether an email has an account and whether it is card-linked

- Location: `telegram-support-bot/app/er_guard_app_api.py:108-111,315-342,446-485`; client prompts in `mobile/lib/auth-errors.ts`.
- Evidence: `request-code` returns distinct `409` codes/messages for `existing_account` and `existing_card_account` before sending an OTP.
- Impact: unauthenticated callers can enumerate registered emails and identify ER Guard cardholders, enabling targeted phishing and privacy profiling.
- Fix: return the same status/body/timing for all request-code outcomes. Send login/recovery guidance only to the address on file, or move the friendly existing-account prompt behind proof of inbox ownership.
- Mitigation: strong IP/device throttling and monitoring reduce enumeration scale.
- False-positive notes: the behavior is intentional UX, but the security/privacy tradeoff is real and should be explicitly accepted if retained.

### SEC-006 — Google email verification fails open when the claim is absent

- Location: `telegram-support-bot/app/er_guard_app_api.py:91-105,777-785`.
- Evidence: `not claims.get("email_verified", True)` treats a missing `email_verified` claim as verified, and an existing account is then selected solely by normalized email.
- Impact: if Google issues an otherwise valid token containing an email but no verification flag, that token could be used to authenticate as the existing ER Guard account with the same address.
- Fix: require `claims.get("email_verified") is True`; validate `sub` and persist/link the Google subject so future logins are not based on email alone. Prefer Google's maintained token-verification library over custom JWT verification.
- Mitigation: log rejected issuer/audience/verification failures without logging the token or full email.
- False-positive notes: standard Google ID tokens normally include `email_verified`; the issue is fail-open behavior at a high-impact account-linking boundary.

### SEC-007 — Untrusted purchase reference and return URI are stored without validation

- Location: `telegram-support-bot/app/er_guard_app_api.py:1087-1097`; `telegram-support-bot/app/er_guard_app_db.py:488-546`.
- Evidence: client-supplied `purchase_reference` is concatenated into `checkout_url` without URL encoding and into an idempotency key; arbitrary `app_return_uri` is stored for later use.
- Impact: crafted references can inject or override checkout query parameters. If the stored return URI is later honored by a payment callback, it can become an open-redirect or unsafe deep-link target.
- Fix: generate the purchase reference server-side or restrict it to a short allowlisted character set and use a URL builder. Allow only the exact production app-link/custom scheme and expected path for `app_return_uri`; reject unknown fields and cap lengths.
- Mitigation: ensure the shop ignores attacker-controlled duplicate parameters and never redirects to the stored URI without validation.
- False-positive notes: the reviewed code does not currently consume `app_return_uri`; part of the impact is therefore forward-looking, while query corruption is present now.

## Low severity / hardening

### SEC-008 — Client accepts a non-HTTPS API base in release configuration

- Location: `mobile/lib/api.ts:4-7`; `mobile/ios/ERGuard/Info.plist` (`NSAllowsLocalNetworking=true`).
- Evidence: `EXPO_PUBLIC_API_BASE_URL` is accepted without validating scheme or host. ATS blocks arbitrary cleartext but allows local networking, and equivalent release enforcement is not visible for Android/web.
- Impact: a misconfigured release could send credentials or bearer tokens to an HTTP or attacker-controlled endpoint.
- Fix: fail closed in non-development builds unless the parsed base URL is `https://api.app.medicareplus.com.ph`; keep development overrides in a separate build profile.
- Mitigation: CI should inspect the resolved Expo config and built artifacts.

### SEC-009 — API proxy leaks raw internal error strings and disallowed CORS origins return 500

- Location: `Medicare Plus Mobile App/medicareplus-api/api/er_guard.js:48-51`; `local_server.js:56-65,87-88`.
- Evidence: proxy exceptions return `err.message` to clients. A live preflight from `https://attacker.example` returned HTML `500` rather than a controlled CORS denial.
- Impact: internal network/runtime details may be exposed; invalid-origin traffic creates noisy 500s and avoidable error load.
- Fix: log a correlation ID server-side and return a constant public `502` message. Add centralized CORS/error middleware that returns a controlled `403`/`400` JSON response.

### SEC-010 — PII is included in backend exception logs

- Location: `telegram-support-bot/app/er_guard_app_api.py:480-484,906-910`.
- Evidence: full normalized email addresses are included in SMTP exception log messages.
- Impact: centralized logs and support exports accumulate member identifiers beyond what is necessary.
- Fix: log an opaque request/account correlation ID or a one-way truncated hash; keep exception details but remove the full address.

### SEC-011 — Expo dependency audit needs manual triage

- Location: `mobile/package.json` and `mobile/package-lock.json`.
- Evidence: `npm audit --omit=dev` reported 14 moderate entries, mainly in Expo build/config tooling plus `decode-uri-component`, `query-string`, and `uuid`. Suggested fixes incorrectly propose major downgrades such as Expo 46 for this Expo 57 project.
- Impact: most exposure appears build/tooling-only, but affected routing/parsing dependencies must be checked against the shipped bundle.
- Fix: upgrade within the supported Expo 57 patch matrix using `npx expo install --fix` after reviewing Expo release guidance; rerun audit and verify the final production dependency graph. Do not apply the proposed downgrade blindly.

## Connection and functional release blockers

### CONN-001 — Live API TLS certificate expires in three days

- Live evidence: the certificate for `api.app.medicareplus.com.ph` was valid from 2026-06-18 03:08:34 UTC through 2026-09-16 03:08:33 UTC, issued by Let's Encrypt YR2.
- Impact: if automated renewal is not already completing, all app API calls will fail certificate validation on or after 2026-09-16.
- Action: verify renewal automation and nginx certificate reload today; confirm the newly served certificate from an external host after renewal. Add expiry monitoring at 30/14/7/3/1 days.

### CONN-002 — Activation fallback URL is wrong and the handoff token is never consumed

- Location: `telegram-support-bot/app/er_guard_app_api.py:1054-1074`; `app/er_guard_app_db.py:443-486`; actual public handler at `app/main.py:51041`.
- Evidence: the source fallback URL is `https://support.medicareplus.help/er-guard/activate`, which returned live HTTP 404. The working public path is `/er-guard-activation`. Repository search found code that creates the `handoff` query token but no code that reads, verifies, consumes, or applies it.
- Impact: unless production's database setting overrides the fallback, tapping Activate opens a dead page. Even with an override, the handoff is ignored and the user must re-enter card credentials.
- Action: point the setting to `/er-guard-activation`; implement an atomic, expiry-checked, single-use handoff-token consumer bound to the activation/account; then test replay, wrong account, expiry, and already-consumed cases. Avoid logging the query token and replace the URL after exchange.

### CONN-003 — Mobile network calls have no client-side timeout

- Location: `mobile/lib/api.ts:11-27`.
- Evidence: `fetch` has no `AbortSignal` timeout.
- Impact: stalled connections can leave login, signup, purchase, or claim UI pending indefinitely.
- Action: add endpoint-appropriate timeouts with safe retries only for idempotent requests. Use idempotency keys for retried mutations.

## Validation performed

- `npx tsc --noEmit` in the mobile project: passed.
- `node --check api/er_guard.js` and `node --check local_server.js`: passed.
- `pytest -q tests/test_er_guard_app.py`: 11 passed.
- `npm audit --omit=dev` (mobile): 14 moderate findings, requiring Expo-aware triage.
- `npm audit --omit=dev` (gateway): 2 high, 2 moderate, 1 low.
- Live `GET /api/patient/er-guard/config`: HTTP 200 with HSTS, no-store, nosniff, and expected configuration.
- Live unauthenticated `GET /api/patient/er-guard/me`: HTTP 401 `Bearer token required`.
- Live disallowed-origin preflight: denied, but returned HTTP 500 rather than a controlled response.
- Live TLS certificate and activation-route checks as described above.
- Scoped source scan found no committed private key or server API secret in the reviewed app/connection files. The Google OAuth client ID in Expo config is a public identifier, not a client secret.

## Positive controls confirmed

- Production API uses HTTPS and advertises HSTS.
- iOS has `NSAllowsArbitraryLoads=false`.
- Bearer tokens are generated with `secrets.token_urlsafe(48)`, stored hashed server-side, checked for expiry/revocation, and protected client-side with SecureStore.
- Passwords are hashed with Werkzeug; reset tokens and activation handoff tokens are random and stored hashed.
- OTPs are random, expire after ten minutes, have an attempt ceiling, and are request-throttled per email and IP.
- Protected purchase lookup verifies account ownership; card handoff creation verifies card ownership; claim queries are account-scoped.
- Card linking checks card number, policy, product type, status, payment, effective/expiry dates, name, birthday, and exclusive ownership.
- SQL values in reviewed paths are parameterized.
- Gateway request bodies are limited and upstream calls have timeouts.

## Residual risks and unverified controls

- No authenticated live member account was used, so end-to-end session rotation, card linking, purchase, claims, deletion, and logout behavior were not dynamically exercised.
- nginx/WAF configuration, production environment values, provider API-key scopes/quotas, database encryption/backups, signing-key handling, CI/CD protections, Android release manifest/network-security config, store artifacts, logging retention, and incident-response procedures were outside the available source or runtime visibility.
- Existing tests cover configuration and key signup/Google cases but do not cover login lockout/IP throttling, logout/revocation, forgot/reset abuse limits, protected-resource authorization, cross-account purchase access, card-link attack cases, handoff replay/expiry, account deletion, or gateway behavior.

## Recommended remediation order

1. Confirm TLS renewal immediately.
2. Remove all credentials/PII from router parameters.
3. Upgrade the Express dependency tree and add route-level regression tests.
4. Add edge IP/device/account abuse limits for every public authentication and high-impact mutation route.
5. Correct and fully implement the activation handoff.
6. Bind biometric credentials in SecureStore and separate Lock from true Sign out.
7. Close the Google verification fail-open and remove account/card enumeration.
8. Validate purchase/deep-link inputs, add client timeouts, sanitize errors/logs, and expand security tests.

## Remediation log — 2026-09-13 (Asia/Manila)

All items below were implemented across the three codebases (`erguard-mobile-app/mobile`,
`Medicare Plus Mobile App/medicareplus-api`, `telegram-support-bot`) and verified as described.

### Mobile (`mobile/`)

- **SEC-001** — New `lib/auth-flow-store.ts`: pending signup data (incl. plaintext
  password) and the Google ID token live in a short-lived (10 min) in-memory store keyed
  by `Crypto.randomUUID()` opaque flow IDs. `sign-up.tsx` / `sign-in.tsx` route only with
  `{ flowId }`; `verify-otp.tsx` / `google-complete.tsx` read the store and show an
  expired-session screen with no secret persistence when the flow is gone. Flows are
  cleared on success, on existing-account redirect, and on sign-out (`clearAllAuthFlows`).
  Only the non-secret email prefill to sign-in remains in params.
- **SEC-004** — `lib/session.ts`: the biometric credential now uses its own keychain
  service with `requireAuthentication: true`, a biometric prompt, and
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (OS-enforced, device-only, no backup migration). The
  regular session is also device-only. `providers/auth-provider.tsx`: `signOut()` is now a
  true sign-out — always revokes the server session and deletes regular + biometric
  credentials; the old retain-session behavior is renamed to `lock()` for honest labeling.
- **SEC-008** — `lib/api.ts`: release builds fail closed unless the base URL parses as
  `https://api.app.medicareplus.com.ph`; dev overrides still work in `__DEV__`.
- **CONN-003** — `lib/api.ts`: every request carries a timeout (auth mutations 25 s,
  reads 15 s, default 20 s) with a friendly timeout error; mutations are never auto-retried.
- Added `api.consumeActivationHandoff()` for the new handoff consumer.
- `ios/ERGuard/Info.plist`: added `ITSAppUsesNonExemptEncryption=false` (HTTPS-only, no
  custom crypto) so TestFlight uploads skip the export-compliance questionnaire.

### Gateway (`medicareplus-api/`)

- **SEC-002** — `api/er_guard.js`: in-memory sliding-window limiter (trusted `req.ip` +
  normalized account identifier) on request-code, signup, login, Google auth/complete,
  forgot/reset, card linking, claims and purchase writes. `429` + `Retry-After` + no-store.
- **SEC-003** — Express `4.21.0` → `4.22.2` plus `"overrides": { "qs": "^6.16.0" }`.
  `npm audit --omit=dev`: **0 vulnerabilities** (was 2 high / 2 moderate / 1 low).
  `body-parser` direct usage removed in favor of built-in Express parsers.
- **SEC-009** — proxy/facilities failures log a server-side correlation ID and return a
  constant public `502 { ok:false, error:'Upstream request failed', request_id }`.
  Central error middleware: CORS denial → controlled JSON `403` (was HTML `500`), bad JSON
  → `400`, all else → constant `500`. Numeric guards on `:activationId`/`:purchaseId`.
- Added the missing `POST /api/patient/er-guard/auth/google`, `/google/complete`, and
  `/cards/activation-handoff/consume` proxies (Google sign-in previously had no gateway
  route), each rate-limited.

### Backend (`telegram-support-bot/`)

- **SEC-005** — `auth/request-code` returns the identical generic `200` body for fresh,
  existing, and card-linked addresses (no OTP sent on conflict); specific `409` codes are
  kept only behind inbox proof (signup with valid OTP, verified Google token).
- **SEC-006** — `_verify_google_id_token` fails closed on a missing `email_verified`
  claim and requires the `sub` claim. Accounts are pinned via new
  `account_profiles.google_sub` (`ErGuardAppDatabase.get/set_google_sub`, Postgres
  migration in `scripts/pg_migration/schema_missing_columns.sql` + legacy SQLite ensure);
  mismatched subjects are rejected, new Google accounts store the subject at creation.
- **SEC-002** — per-IP locks added to login and Google auth (caller-controlled email key
  is no longer the sole key); `forgot-password` (5/hr per account, 20/hr per IP) and
  `reset-password` (10/hr per account, 30/hr per IP) throttled via OTP buckets.
- **SEC-007** — `validate_purchase_reference` (allowlist `^[A-Za-z0-9_-]{1,64}$`) and
  `validate_app_return_uri` (only `erguard://checkout…` and
  `https://api.app.medicareplus.com.ph/erguard/checkout…`, ≤256 chars); checkout URL built
  with `urlencode`.
- **SEC-010** — SMTP/reset exception logs use a truncated SHA-256 hash, never the address.
- **CONN-002** — activation fallback default corrected to
  `https://support.medicareplus.help/er-guard-activation` (live `200`; old path live
  `404`); new `POST /api/v1/er-guard-app/cards/activation-handoff/consume` with atomic,
  expiry-checked, single-use, account-bound redemption (`consume_activation_handoff`).

### Validation (2026-09-13)

- `npx tsc --noEmit` (mobile): passed.
- `node --check api/er_guard.js`, `local_server.js`: passed.
- `pytest tests/test_er_guard_app.py`: **19 passed** (11 pre-existing incl. 3 updated for
  SEC-005, 8 new: inbox-proof conflict, Google fail-closed ×2, sub binding/mismatch,
  purchase validation, handoff consume/replay/wrong-account/expiry, forgot throttle +
  enumeration safety, login IP spray block).
- `pytest tests/test_mobile_member_account.py tests/test_security_hardening.py`: 10 passed,
  2 failed — both failures are pre-existing webhook/embed tests with no `er_guard`
  involvement (verified unrelated to this change set).
- `npm audit --omit=dev` gateway: 0 vulnerabilities. Mobile: 14 moderate, all in
  build/tooling (`@expo/*` config/metro chain) plus `query-string`/`decode-uri-component`
  via expo-router and `uuid` via `xcode`; no clean fix inside the Expo 57 patch matrix
  (auditor proposes an Expo 46 downgrade — rejected). Accepted residual: SEC-001 now keeps
  secrets out of route params (the practical attack surface for the parsing advisories).
- Gateway boot smoke test vs local stub upstream: 65 rapid logins → first 60 proxied,
  then `429` with `Retry-After: 600` and controlled JSON; attacker-origin preflight → JSON
  `403` (was HTML `500`); non-numeric purchase id → JSON `400`.
- Live: `api.app.medicareplus.com.ph` cert still expires **2026-09-16 03:08:33 UTC**
  (Let's Encrypt YR2) — renewal must happen on the VPS (below).

### Operator actions left (VPS + Xcode, not doable from this laptop)

1. **TLS (CONN-001, due ≤ 2026-09-16):** on the VPS: `certbot renew --force-renewal` (or
   `certbot renew --dry-run` first to confirm automation), then `nginx -t && systemctl
   reload nginx`, then re-verify externally:
   `echo | openssl s_client -connect api.app.medicareplus.com.ph:443 -servername
   api.app.medicareplus.com.ph 2>/dev/null | openssl x509 -noout -dates`. Add expiry
   monitoring at 30/14/7/3/1 days.
2. **Deploy gateway:** `cd medicareplus-api && npm ci && node --check api/er_guard.js &&
   node --check local_server.js`, restart via pm2 (`pm2 restart medicareplus-api` per
   `ecosystem.config.cjs`), confirm `npm audit --omit=dev` stays clean.
3. **Deploy backend:** pull, run Flask startup migrations (applies
   `schema_missing_columns.sql` → `google_sub`), restart gunicorn/systemd, run
   `pytest tests/test_er_guard_app.py -q` on the server.
4. **DB setting (optional):** if `er_guard_app_settings.legal.activation_base_url` is set
   in production, point it at `https://support.medicareplus.help/er-guard-activation`;
   the code default is already correct.
5. **Xcode/TestFlight:** open `mobile/ios/ERGuard.xcworkspace` (not the xcodeproj), select
   the `ERGuard` scheme → Any iOS Device (arm64), bump `MARKETING_VERSION` /
   `CURRENT_PROJECT_VERSION` if this is a new TestFlight build, Product → Archive, then
   Distribute App → App Store Connect → TestFlight. Prerequisites: Apple Developer
   membership, the `com.medicareplus.erguard` App ID with Associated Domains
   (`applinks:api.app.medicareplus.com.ph` — already in entitlements), and a device
   running iOS 12+. First `npx expo prebuild --platform ios --clean` only if native files
   drift from `app.json`.
6. **Post-deploy checks:** login → biometric enable → true sign-out → biometric unlock
   attempt must fail (credential gone); Google sign-in for a new user (profile completion)
   and an existing user; purchase with crafted `purchase_reference`/`app_return_uri`
   rejected; activation link opens the live page and the handoff consumes exactly once.
