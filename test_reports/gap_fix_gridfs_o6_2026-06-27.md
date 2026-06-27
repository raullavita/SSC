# Gap fix — GridFS orphans + O.6 Mongo egress (2026-06-27)

## GridFS orphan cleanup — PASS

| Database | Before | Janitor run | After proof |
|----------|--------|-------------|-------------|
| `ssc` (production) | 0 orphans | n/a | PASS |
| `ssc-dev` (local `.env`) | 7 orphans | deleted 7/7 | PASS |

Commands:

```powershell
# dev cleanup
backend\venv\Scripts\python.exe scripts\retention_janitor.py --json
backend\venv\Scripts\python.exe scripts\retention_proof.py

# production proof (cloud_run.env)
# deploy gate: prepare_cloud_run_deploy.py — PASS
```

Janitor fix: `retention_janitor.py` now loops GridFS batches until a full pass finds zero orphans.

## O.6 Mongo network — GCP APPLIED

| Item | Status |
|------|--------|
| Static NAT IP `ssc-nat-ip` | **34.140.240.41** |
| Cloud NAT `ssc-cloud-nat` | MANUAL_ONLY |
| VPC connector `ssc-vpc-connector` | READY `10.8.0.0/28` |
| Cloud Run `ssc-api` revision | **ssc-api-00021-6k6** · `vpc-egress=all-traffic` |
| Production health | `mongo: ok` · `redis: ok` |

Scripts:

- `scripts/setup_gcp_nat_egress.ps1` — idempotent re-apply
- `scripts/apply_atlas_ip_allowlist.py` — Atlas allowlist (needs `backend/atlas-api.env`)
- `scripts/deploy_cloud_run.ps1` — now pins VPC connector on deploy

## O.6 Atlas allowlist — CLOSED (founder, 27 Jun 2026)

| IP | Comment |
|----|---------|
| `34.140.240.41/32` | SSC Cloud Run NAT |
| `86.166.40.195/32` | Founder laptop (Auto Setup) |

`0.0.0.0/0` removed. Health: `https://api.supersecurechat.com/api/health` → mongo ok, redis ok.