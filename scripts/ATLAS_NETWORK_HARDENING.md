# MongoDB Atlas network hardening (TASK O.6)

**When:** After scale-up or before public launch if you want a smaller attack surface.

## Current state

- Atlas cluster `ssc` allows Cloud Run via `0.0.0.0/0` (any IP with credentials).
- Credentials live in `backend/cloud_run.env` (gitignored).

## Recommended steps (Atlas UI)

1. Open [MongoDB Atlas](https://cloud.mongodb.com) → **Network Access**.
2. Note Cloud Run does **not** have fixed egress IPs on default setup.
3. Options:
   - **Short term:** Keep `0.0.0.0/0` but rotate DB password quarterly and use least-privilege DB user.
   - **Medium:** VPC connector + static NAT IP on GCP → allowlist that IP in Atlas.
   - **Long:** Atlas **Private Endpoint** (paid feature) + VPC peering.

## GCP static egress (optional script path)

```bash
# After configuring Cloud NAT on your VPC connector subnet:
gcloud compute addresses describe ssc-nat-ip --region=YOUR_REGION --format='get(address)'
```

Add that IP in Atlas → Network Access → Add IP Address.

## Verification

```bash
curl -s https://api.supersecurechat.com/api/health | jq .mongo
```

Should remain `ok` after any allowlist change.

## Cost note

- IP allowlist changes: **free**
- Private Endpoint / dedicated peering: **paid** Atlas/GCP networking — defer until traffic justifies it