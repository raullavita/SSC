# SSC 10k Readiness Hardening Plan

## Objective
Prepare SSC for a realistic 10,000-user rollout with explicit controls for abuse resistance, reliability, observability, and security operations, while preserving E2EE guarantees and current feature scope.

## Current Snapshot
- Backend and frontend core tests are passing.
- Native Android and Qt desktop lanes produce release artifacts.
- Baseline security scans are mostly clean, with a remaining high advisory in frontend dependency lineage.
- Abuse/rate controls exist and were strengthened with conversation-level throttling and per-device ciphertext map limits.
- Known deferred items remain: Android/Windows encrypted-session interop issue and UI parity gaps.

## Readiness Targets (Definition of Done)
- Availability: p95 API success rate >= 99.9% over 30 days.
- Latency: p95 send-message API latency <= 250 ms at projected peak load.
- Abuse: automated controls block >= 95% of scripted spam attempts in canary simulations.
- Security: zero known high/critical vulns in shipped dependencies.
- Recovery: documented and tested restore drill with RTO <= 60 minutes and RPO <= 5 minutes.
- Operability: on-call runbook + alert playbooks cover top 10 incident classes.

## 30/60/90-Day Milestones

### Day 0-30 (Stabilize and Instrument)
1. Abuse and messaging guardrails
- Keep per-user and per-conversation message throttles enabled in production.
- Add server-side metrics for 429 rates by endpoint and by tenant/channel type.
- Add payload anomaly counters for oversized or malformed device ciphertext payloads.

2. Observability baseline
- Add structured logging fields: request_id, user_id hash, conversation_id hash, route, outcome, latency_ms.
- Publish dashboards for API latency, error rates, websocket fanout lag, push delivery attempts.
- Add alerting thresholds for auth spikes, send-message 5xx, and redis/mongo degraded states.

3. Dependency and build hygiene
- Resolve the frontend high advisory (react-router lineage) by upgrade, replace, or documented temporary mitigation.
- Pin CI security checks for backend + frontend in one release gate.

Acceptance criteria (Day 30)
- Dashboards visible and populated in staging + production.
- At least 3 abuse-focused alerts firing correctly in synthetic tests.
- Zero unresolved high/critical dependency findings in release branch.

### Day 31-60 (Scale and Fault Tolerance)
1. Load and resilience tests
- Build repeatable load scenarios for register/login, conversation fetch, message send, and websocket fanout.
- Introduce chaos drills: redis unavailable, mongo latency injection, push provider timeout.

2. Data and queue hardening
- Verify indexes for hot query paths in messages, conversations, prekeys, receipts.
- Add backpressure strategy for fanout bursts (queue caps, drop policy for non-critical events).
- Add retry/jitter strategy for transient downstream failures.

3. Abuse model refinement
- Add reputation tiers (new account, warmed account, trusted account) tied to dynamic rate buckets.
- Add temporary challenge/escalation hooks for repeated suspicious send patterns.

Acceptance criteria (Day 60)
- Demonstrated stable operation under 2x projected peak in staging load tests.
- No cascading failure during chaos drills for redis/mongo partial outage scenarios.
- Abuse simulation reports >= 95% scripted spam mitigation with low false-positive sample review.

### Day 61-90 (Operational Maturity and Launch Readiness)
1. Security operations
- Complete incident response tabletop for account takeover, spam campaign, and credential leak scenarios.
- Enforce release signing/attestation checks across Android, desktop, and backend deploy pipeline.

2. DR and business continuity
- Execute end-to-end recovery drill from backup snapshots.
- Validate secret rotation runbook with timed execution and rollback procedure.

3. Launch guardrails
- Roll out canary + progressive traffic ramp with automatic rollback thresholds.
- Define launch readiness review checklist with owner sign-off (engineering, security, ops).

Acceptance criteria (Day 90)
- Two successful game-day exercises with postmortems and action closure.
- Recovery drill meets RTO/RPO targets.
- Progressive rollout controls validated in production-like environment.

## Priority Workstreams

### A. Abuse and Messaging Resilience
- Completed now:
- Per-conversation message burst throttling.
- Per-device ciphertext target/size limits.

- Next:
- Dynamic abuse scoring into enforcement decisions.
- Conversation-level temporary lockdown for repeated violations.
- Moderator/ops visibility endpoint for abuse trends.

### B. Security and Supply Chain
- Remove high-risk frontend advisory.
- Expand automated SAST/dep checks per commit and per release branch.
- Add signed SBOM artifact to release workflow.

### C. Reliability and Runtime
- Fanout queue monitoring and lag alarms.
- Background job idempotency checks.
- Controlled degradation mode for optional services.

### D. Product Risk (Deferred but Required Before Broad Launch)
- Fix Android/Windows session mismatch causing "message unavailable" and "session not found" encryption failures.
- Close key UI parity gaps for settings/security workflows.

## Immediate Execution Queue (This Week)
1. Ship the current abuse hardening patch set (done in branch).
2. Add metrics for new conversation throttle and device ciphertext rejection paths.
3. Run broader backend tests and staged soak test for message flows. (done)
4. Remediate the frontend high dependency advisory.
5. Open dedicated epic for cross-platform session interop fix with reproducible test matrix.

## Soak Validation Evidence (2026-08-02)
- Harness: backend/scripts/message_soak_test.py
- Runner: scripts/run_backend_message_soak.ps1
- Command (quick stage):
	- C:/Users/smash/.ssc-tools/python312/python.exe scripts/message_soak_test.py --users 4 --messages-per-conversation 30 --concurrency 8 --max-error-rate 0.02 --max-p95-ms 300
- Result (quick stage):
	- passed=true, total_messages=90, error_rate=0.0, p95_ms=93.88
- Command (default stage):
	- C:/Users/smash/.ssc-tools/python312/python.exe scripts/message_soak_test.py --users 8 --messages-per-conversation 120 --concurrency 24 --max-error-rate 0.01 --max-p95-ms 250
- Result (default stage):
	- passed=true, total_messages=840, error_rate=0.0, p95_ms=154.732

## Ownership and Cadence
- Engineering lead: backend hardening, load test implementation, runtime SLOs.
- Security lead: vuln posture, incident drills, release policy enforcement.
- Release lead: canary rollout process and rollback automation.
- Weekly checkpoint: update this plan with status, blockers, and evidence links.
