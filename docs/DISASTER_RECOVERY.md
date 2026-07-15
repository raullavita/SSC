# SSC Disaster Recovery (one-pager)

**Scope:** Restore API, database, and messaging if GCP or MongoDB Atlas fails.  
**Not in scope:** Per-user chat history recovery (messages expire after 24h by design).

## What we protect

| Asset | Where | Backup |
|-------|-------|--------|
| User accounts, keys metadata, friendships | MongoDB Atlas (`ssc` DB) | Atlas continuous backup (M10+); free tier snapshots — verify in Atlas UI |
| Sessions, rate limits, WS fanout | Upstash Redis | Ephemeral — users re-login after restore |
| API container | Cloud Run `ssc-api` | Redeploy from `main` branch |
| Web landing | Firebase Hosting | Redeploy `scripts/deploy_hosting.ps1` |
| SFU / TURN | GCE VMs | Redeploy per `memory/SFU_TURN_RUNBOOK.md` |
| Secrets | Cloud Run env + local `cloudrun-env.yaml` (gitignored) | Store offline copy; rotate with `scripts/rotate_production_secrets.py` |

## RTO / RPO targets (solo operator)

- **RPO (data loss):** ≤ 24h for Mongo (Atlas snapshot window; confirm tier in console)
- **RTO (downtime):** 2–4h manual restore (no on-call team yet)

## Restore procedure (high level)

1. **Confirm outage** — `.\scripts\release_smoke_test.ps1` and Atlas/Cloud Run status pages.
2. **MongoDB** — Atlas → Backup → restore cluster or point-in-time restore to new cluster; update `MONGO_URL` in Cloud Run.
3. **API** — `.\scripts\deploy_cloud_run.ps1` (with `backend/cloudrun-env.yaml`).
4. **Web** — `.\scripts\deploy_hosting.ps1`.
5. **SFU/TURN** — follow `memory/SFU_TURN_RUNBOOK.md`; update `SSC_SFU_INTERNAL_URL` if IP changed.
6. **Verify** — `.\scripts\verify_production_wiring.ps1` + register/login smoke on installed client.

## Quarterly checks

- [ ] Atlas: confirm backups enabled and download a test export (optional)
- [ ] Run `.\scripts\verify_production_wiring.ps1`
- [ ] Confirm `SSC_PASSWORD_PEPPER` and JWT rotation plan documented offline
- [ ] Confirm `cloudrun-env.yaml` backup exists outside git

## Account recovery vs DR

Users recover **accounts** via email/password or Google sign-in plus optional recovery passphrase (`RecoveryPanel`).  
They do **not** recover old message text after TTL expiry — that is intentional for privacy.