'use strict';

const os = require('os');

const listenPort = Number(process.env.SFU_PORT || 4443);
const announcedIp = (process.env.SFU_ANNOUNCED_IP || '').trim()
  || (process.env.NODE_ENV === 'production' ? '' : '127.0.0.1');

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: { 'x-google-start-bitrate': 1000 },
  },
];

function workerSettings() {
  return {
    logLevel: process.env.SFU_LOG_LEVEL || 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    rtcMinPort: Number(process.env.SFU_RTC_MIN_PORT || 40000),
    rtcMaxPort: Number(process.env.SFU_RTC_MAX_PORT || 49999),
  };
}

function webRtcTransportOptions() {
  const listenIps = announcedIp
    ? [{ ip: announcedIp, announcedIp }]
    : [{ ip: '0.0.0.0', announcedIp: undefined }];
  return {
    listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 600000,
  };
}

module.exports = {
  listenPort,
  announcedIp,
  mediaCodecs,
  workerSettings,
  webRtcTransportOptions,
  hostname: os.hostname(),
};