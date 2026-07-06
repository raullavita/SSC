(function () {
  if (window.sscCrypto && window.sscCrypto.__sscNative) return;

  var bridge = window.__sscBridge || {};
  window.__sscBridge = bridge;
  var pending = bridge._pending || new Map();
  bridge._pending = pending;
  var nextId = bridge._nextId || 1;
  bridge._nextId = nextId;

  function invoke(method, args) {
    return new Promise(function (resolve, reject) {
      var id = String(nextId++);
      bridge._nextId = nextId;
      pending.set(id, { resolve: resolve, reject: reject });
      var payload = JSON.stringify(args || {});
      if (bridge.invoke) {
        bridge.invoke(method, id, payload);
      } else {
        pending.delete(id);
        reject(new Error('ssc_native_bridge_missing'));
      }
    });
  }

  if (!bridge._callback) {
    bridge._callback = function (id, ok, payload) {
    var entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (ok) {
      if (typeof payload === 'string') {
        entry.resolve(payload);
      } else {
        entry.resolve(payload);
      }
    } else {
      entry.reject(new Error(typeof payload === 'string' ? payload : 'ssc_crypto_failed'));
    }
    };
  }

  window.sscCrypto = {
    __sscNative: true,
    get available() {
      return true;
    },
    configure: function (opts) {
      return invoke('configure', opts || {});
    },
    generatePreKeyBundle: function () {
      return invoke('generatePreKeyBundle', {});
    },
    establishSession: function (peerId, deviceId, bundle) {
      return invoke('establishSession', { peerId: peerId, deviceId: deviceId || '1', bundle: bundle });
    },
    encryptMessage: function (plaintext, peerId, deviceId) {
      return invoke('encryptMessage', { plaintext: plaintext, peerId: peerId, deviceId: deviceId || '1' });
    },
    decryptMessage: function (ciphertext, peerId, deviceId) {
      return invoke('decryptMessage', { ciphertext: ciphertext, peerId: peerId, deviceId: deviceId || '1' });
    },
    encryptBytes: function (arrayBuffer) {
      var bytes = new Uint8Array(arrayBuffer);
      var binary = '';
      for (var i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      return invoke('encryptBytes', { buffer: btoa(binary) });
    },
    computeSafetyNumber: function (peerId, peerIdentityKey) {
      return invoke('computeSafetyNumber', { peerId: peerId, peerIdentityKey: peerIdentityKey });
    },
    wipeLocalData: function () {
      return invoke('wipeLocalData', {});
    },
    configureGroupKeys: function (opts) {
      return invoke('configureGroupKeys', opts || {});
    },
    getGroupDistributionState: function (groupId) {
      return invoke('getGroupDistributionState', { groupId: groupId });
    },
    createGroupDistribution: function (groupId) {
      return invoke('createGroupDistribution', { groupId: groupId });
    },
    markGroupDistributionSent: function (groupId) {
      return invoke('markGroupDistributionSent', { groupId: groupId });
    },
    processGroupDistribution: function (args) {
      return invoke('processGroupDistribution', args || {});
    },
    encryptGroupMessage: function (groupId, plaintext) {
      return invoke('encryptGroupMessage', { groupId: groupId, plaintext: plaintext });
    },
    decryptGroupMessage: function (senderId, deviceId, ciphertext) {
      return invoke('decryptGroupMessage', {
        senderId: senderId,
        deviceId: deviceId || '1',
        ciphertext: ciphertext,
      });
    },
  };
})();