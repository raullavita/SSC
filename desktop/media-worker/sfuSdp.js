/**
 * SDP helpers for mediasoup SFU — ported from Android SfuMediaEngine.kt
 */

function extractDtlsParameters(sdp) {
  const lines = String(sdp || '').split(/\r?\n/);
  const fpLine = lines.find((l) => l.startsWith('a=fingerprint:'));
  if (!fpLine) return null;
  const rest = fpLine.replace('a=fingerprint:', '').trim();
  const sp = rest.indexOf(' ');
  if (sp < 0) return null;
  const algorithm = rest.slice(0, sp);
  const value = rest.slice(sp + 1);
  const setupLine = lines.find((l) => l.startsWith('a=setup:'));
  const setup = setupLine ? setupLine.replace('a=setup:', '').trim() : 'active';
  const role = setup === 'passive' ? 'server' : 'client';
  return {
    fingerprints: [{ algorithm, value }],
    role,
  };
}

function extractRtpParametersFromSdp(sdp, kind) {
  const blocks = String(sdp || '').split(/(?=m=)/);
  const media = blocks.find((b) => b.startsWith(`m=${kind}`));
  if (!media) return null;
  const midM = media.match(/a=mid:(\S+)/);
  const mid = midM ? midM[1] : kind === 'audio' ? '0' : '1';
  const ptM = media.match(new RegExp(`m=${kind}\\s+\\S+\\s+\\S+\\s+(\\d+)`));
  if (!ptM) return null;
  const pt = parseInt(ptM[1], 10);
  const rtpmap = media.match(new RegExp(`a=rtpmap:${pt}\\s+([^/]+)/(\\d+)(?:/(\\d+))?`));
  const codecName = rtpmap ? rtpmap[1] : kind === 'audio' ? 'opus' : 'VP8';
  const clock = rtpmap ? parseInt(rtpmap[2], 10) : kind === 'audio' ? 48000 : 90000;
  const channels = rtpmap && rtpmap[3] ? parseInt(rtpmap[3], 10) : kind === 'audio' ? 2 : undefined;
  const ssrcM = media.match(/a=ssrc:(\d+)\s/);
  if (!ssrcM) return null;
  const ssrc = parseInt(ssrcM[1], 10);
  const cnameM = media.match(new RegExp(`a=ssrc:${ssrc}\\s+cname:(\\S+)`));
  const cname = cnameM ? cnameM[1] : 'ssc-sfu';
  const mime = kind === 'audio' ? `audio/${codecName}` : `video/${codecName}`;
  const fmtpM = media.match(new RegExp(`a=fmtp:${pt}\\s+(.+)`));
  const parameters = {};
  if (fmtpM) {
    for (const part of fmtpM[1].split(';')) {
      const kv = part.trim().split('=');
      if (kv.length === 2) {
        const n = Number(kv[1]);
        parameters[kv[0]] = Number.isFinite(n) && String(n) === kv[1] ? n : kv[1];
      }
    }
  } else if (kind === 'audio') {
    parameters.minptime = 10;
    parameters.useinbandfec = 1;
  }
  const codec = {
    mimeType: mime,
    payloadType: pt,
    clockRate: clock,
    parameters,
    rtcpFeedback: [],
  };
  if (kind === 'audio') codec.channels = channels || 2;
  if (kind === 'video') {
    codec.rtcpFeedback = [
      { type: 'nack' },
      { type: 'nack', parameter: 'pli' },
      { type: 'ccm', parameter: 'fir' },
      { type: 'goog-remb' },
    ];
  }
  const headerExtensions = [{ uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', id: 1 }];
  if (kind === 'audio') {
    headerExtensions.push({ uri: 'urn:ietf:params:rtp-hdrext:ssrc-audio-level', id: 10 });
  } else {
    headerExtensions.push({
      uri: 'http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time',
      id: 3,
    });
  }
  return {
    mid,
    codecs: [codec],
    headerExtensions,
    encodings: [{ ssrc }],
    rtcp: { cname, reducedSize: true },
  };
}

function audioRtpFallback() {
  return {
    mid: '0',
    codecs: [
      {
        mimeType: 'audio/opus',
        payloadType: 111,
        clockRate: 48000,
        channels: 2,
        parameters: { minptime: 10, useinbandfec: 1 },
        rtcpFeedback: [],
      },
    ],
    headerExtensions: [
      { uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', id: 1 },
      { uri: 'urn:ietf:params:rtp-hdrext:ssrc-audio-level', id: 10 },
    ],
    encodings: [{ ssrc: 11111111 }],
    rtcp: { cname: 'ssc-sfu', reducedSize: true },
  };
}

function buildClientRtpCapabilities(routerCaps) {
  if (routerCaps && Array.isArray(routerCaps.codecs) && routerCaps.codecs.length) {
    const codecs = routerCaps.codecs.filter((c) => {
      const m = String(c.mimeType || '');
      return /opus|VP8|rtx/i.test(m);
    });
    if (codecs.length) {
      return {
        codecs,
        headerExtensions: routerCaps.headerExtensions || [],
      };
    }
  }
  return {
    codecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        preferredPayloadType: 111,
        parameters: {},
        rtcpFeedback: [],
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        preferredPayloadType: 96,
        parameters: {},
        rtcpFeedback: [
          { type: 'nack' },
          { type: 'nack', parameter: 'pli' },
        ],
      },
    ],
    headerExtensions: [
      { kind: 'audio', uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', preferredId: 1 },
      { kind: 'video', uri: 'urn:ietf:params:rtp-hdrext:sdes:mid', preferredId: 1 },
    ],
  };
}

function buildRemoteIceSdp(ufrag, pwd, candidates, dtls, mids) {
  const fps = (dtls && dtls.fingerprints) || [];
  const fp = fps[0] || {};
  const algo = fp.algorithm || 'sha-256';
  const value = fp.value || '';
  const midList = mids && mids.length ? mids : ['0'];
  const lines = [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=ice-lite',
    `a=group:BUNDLE ${midList.join(' ')}`,
    'a=msid-semantic: WMS *',
  ];
  midList.forEach((mid, idx) => {
    lines.push(`m=audio 9 UDP/TLS/RTP/SAVPF 111`);
    lines.push('c=IN IP4 0.0.0.0');
    lines.push('a=rtcp:9 IN IP4 0.0.0.0');
    lines.push(`a=ice-ufrag:${ufrag}`);
    lines.push(`a=ice-pwd:${pwd}`);
    if (value) lines.push(`a=fingerprint:${algo} ${value}`);
    lines.push('a=setup:actpass');
    lines.push(`a=mid:${mid}`);
    lines.push(idx === 0 ? 'a=recvonly' : 'a=recvonly');
    lines.push('a=rtcp-mux');
    lines.push('a=rtpmap:111 opus/48000/2');
    for (const c of candidates || []) {
      const foundation = c.foundation || '1';
      const priority = c.priority || 1;
      const ip = c.ip || c.address || '0.0.0.0';
      const port = c.port || 0;
      const type = c.type || 'host';
      const protocol = (c.protocol || 'udp').toUpperCase();
      lines.push(`a=candidate:${foundation} 1 ${protocol} ${priority} ${ip} ${port} typ ${type}`);
    }
  });
  return `${lines.join('\r\n')}\r\n`;
}

function buildMultiRecvOfferSdp(consumers, transport) {
  if (!consumers.length || !transport) return null;
  const ice = transport.iceParameters || {};
  const ufrag = ice.usernameFragment || ice.usernamefragment || '';
  const pwd = ice.password || '';
  const dtls = transport.dtlsParameters || {};
  const fps = dtls.fingerprints || [];
  const fp = fps[0] || {};
  const algo = fp.algorithm || 'sha-256';
  const value = fp.value || '';
  const mids = consumers.map((_, i) => String(i));
  const lines = [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=ice-lite',
    `a=group:BUNDLE ${mids.join(' ')}`,
    'a=msid-semantic: WMS *',
  ];
  consumers.forEach((c, i) => {
    const kind = c.kind || 'audio';
    const rtp = c.rtpParameters || {};
    const codecs = rtp.codecs || [];
    const codec = codecs[0] || {
      mimeType: kind === 'audio' ? 'audio/opus' : 'video/VP8',
      payloadType: kind === 'audio' ? 111 : 96,
      clockRate: kind === 'audio' ? 48000 : 90000,
      channels: 2,
    };
    const pt = codec.payloadType || (kind === 'audio' ? 111 : 96);
    const mime = (codec.mimeType || '').split('/')[1] || (kind === 'audio' ? 'opus' : 'VP8');
    const clock = codec.clockRate || (kind === 'audio' ? 48000 : 90000);
    const ch = codec.channels;
    const enc = (rtp.encodings && rtp.encodings[0]) || {};
    const ssrc = enc.ssrc || 1;
    const cname = (rtp.rtcp && rtp.rtcp.cname) || 'remote';
    const mid = rtp.mid != null ? String(rtp.mid) : String(i);
    const pts = codecs.map((x) => x.payloadType).filter(Boolean).join(' ') || String(pt);
    lines.push(`m=${kind} 9 UDP/TLS/RTP/SAVPF ${pts}`);
    lines.push('c=IN IP4 0.0.0.0');
    lines.push('a=rtcp:9 IN IP4 0.0.0.0');
    lines.push(`a=ice-ufrag:${ufrag}`);
    lines.push(`a=ice-pwd:${pwd}`);
    if (value) lines.push(`a=fingerprint:${algo} ${value}`);
    lines.push('a=setup:actpass');
    lines.push(`a=mid:${mid}`);
    lines.push('a=recvonly');
    lines.push('a=rtcp-mux');
    if (kind === 'audio' && ch) lines.push(`a=rtpmap:${pt} ${mime}/${clock}/${ch}`);
    else lines.push(`a=rtpmap:${pt} ${mime}/${clock}`);
    if (codec.parameters && Object.keys(codec.parameters).length) {
      const fmtp = Object.entries(codec.parameters)
        .map(([k, v]) => `${k}=${v}`)
        .join(';');
      lines.push(`a=fmtp:${pt} ${fmtp}`);
    }
    lines.push(`a=ssrc:${ssrc} cname:${cname}`);
    for (const cand of transport.iceCandidates || []) {
      const foundation = cand.foundation || '1';
      const priority = cand.priority || 1;
      const ip = cand.ip || cand.address || '0.0.0.0';
      const port = cand.port || 0;
      const type = cand.type || 'host';
      const protocol = (cand.protocol || 'udp').toUpperCase();
      lines.push(
        `a=candidate:${foundation} 1 ${protocol} ${priority} ${ip} ${port} typ ${type}`,
      );
    }
  });
  return `${lines.join('\r\n')}\r\n`;
}

function iceCandidateToRtc(c) {
  const foundation = c.foundation || 'sfu';
  const priority = c.priority || 1;
  const ip = c.ip || c.address || '0.0.0.0';
  const port = c.port || 0;
  const type = c.type || 'host';
  const protocol = (c.protocol || 'udp').toLowerCase();
  const candStr = `candidate:${foundation} 1 ${protocol} ${priority} ${ip} ${port} typ ${type}`;
  return {
    candidate: candStr,
    sdpMid: c.sdpMid != null ? String(c.sdpMid) : '0',
    sdpMLineIndex: c.sdpMLineIndex != null ? c.sdpMLineIndex : 0,
  };
}

module.exports = {
  extractDtlsParameters,
  extractRtpParametersFromSdp,
  audioRtpFallback,
  buildClientRtpCapabilities,
  buildRemoteIceSdp,
  buildMultiRecvOfferSdp,
  iceCandidateToRtc,
};
