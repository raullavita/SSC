# SFU / TURN operations runbook

Mediasoup SFU and coturn TURN run on the same GCE instance (`ssc-sfu`, `europe-west1-b`). Cloud Run hosts signaling only; media uses UDP on GCE.

## Architecture

| Component | Host | Ports | DNS |
|-----------|------|-------|-----|
| API (signaling) | Cloud Run `ssc-api` europe-west1 | HTTPS 443 | api.supersecurechat.com |
| SFU (mediasoup) | GCE `ssc-sfu` | TCP 4443, UDP 40000-49999 | sfu.supersecurechat.com (WSS via Caddy :443) |
| TURN/STUN (coturn) | Same GCE instance | UDP/TCP 3478, 5349 | turn.supersecurechat.com |

## One-time setup

1. **Deploy SFU container**
   ```powershell
   $env:SFU_INTERNAL_SECRET = "<rotated-secret-matches-cloudrun>"
   .\scripts\deploy_sfu_gce.ps1
   ```

2. **DNS A records** (at your DNS provider)
   - `sfu.supersecurechat.com` → GCE public IP
   - `turn.supersecurechat.com` → same IP

3. **TLS for WSS**
   ```powershell
   .\scripts\deploy_sfu_tls.ps1 -UpdateCloudRun
   ```

4. **TURN**
   ```powershell
   $env:SSC_TURN_SECRET = "<same-as-turnserver.conf>"
   .\scripts\deploy_turn_gce.ps1 -UpdateCloudRun
   ```

5. **API env** — local `backend/cloudrun-env.yaml` (gitignored):
   - `SSC_SFU_ENABLED=true`
   - `SSC_SFU_WS_URL=wss://sfu.supersecurechat.com`
   - `SSC_SFU_INTERNAL_URL=http://<GCE_IP>:4443`
   - `SSC_SFU_INTERNAL_SECRET=<secret>`
   - `SSC_TURN_*` vars from `deploy_turn_gce.ps1` output

6. **Redeploy API**
   ```powershell
   .\scripts\deploy_cloud_run.ps1
   ```

## Verify

```powershell
.\scripts\release_smoke_test.ps1
curl https://sfu.supersecurechat.com/health
```

`/api/health` should show `sfu.enabled: true` and `sfu.ws_url: wss://sfu.supersecurechat.com`.

## IP changed (instance recreate / migration)

```powershell
.\scripts\update_sfu_internal_url.ps1 -Deploy
.\scripts\deploy_sfu_gce.ps1          # sets SFU_ANNOUNCED_IP on container
.\scripts\deploy_sfu_tls.ps1          # if Caddy config changed
.\scripts\deploy_turn_gce.ps1 -UpdateCloudRun
```

Update DNS A records if the public IP changed.

## Secret rotation

Quarterly or after leak:

```powershell
# Requires atlas-credentials.env (gitignored)
python scripts/rotate_production_secrets.py
.\scripts\deploy_cloud_run.ps1
$env:SFU_INTERNAL_SECRET = "<new from cloudrun-env.yaml>"
.\scripts\deploy_sfu_gce.ps1
```

Redis-only rotation: `python scripts/rotate_redis_only.py`

## Firewall rules (GCP)

| Rule | Ports | Tag |
|------|-------|-----|
| ssc-sfu-media | UDP 40000-49999, TCP 4443 | ssc-sfu |
| ssc-sfu-https | TCP 443 | ssc-sfu |
| ssc-turn | UDP/TCP 3478, 5349 | ssc-sfu |

## Group call cleanup

Clients call `POST /api/sfu/rooms/{room_id}/end` when a group call ends. API forwards to SFU internal URL. If rooms linger, SSH to instance and restart the SFU container.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Group calls fail >8 participants | SFU WSS reachable; `SSC_SFU_INTERNAL_URL` IP correct |
| No TURN relay | coturn running; `SSC_TURN_SECRET` matches turnserver.conf |
| WSS cert errors | Caddy running; DNS points to current IP |
| API can't reach SFU | Cloud Run VPC + SFU internal URL uses public GCE IP:4443 |