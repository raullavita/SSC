# SSC SFU Server (mediasoup)

OSS selective forwarding unit for group calls with more than 8 participants.

## Start locally

```bash
npm install
npm start
```

Set in backend `.env`:

```
SSC_SFU_ENABLED=true
SSC_SFU_WS_URL=ws://localhost:4443
```

## Production

Deploy alongside Cloud Run API. Open UDP ports 40000-49999 for WebRTC media.