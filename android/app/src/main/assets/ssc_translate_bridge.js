(function () {
  if (window.sscTranslate && window.sscTranslate.__sscNative) return;

  var bridge = window.__sscBridge || {};
  window.__sscBridge = bridge;
  var pending = bridge._pending || new Map();
  bridge._pending = pending;
  var nextId = bridge._nextId || 1;
  bridge._nextId = nextId;

  if (!bridge._callback) {
    bridge._callback = function (id, ok, payload) {
      var entry = pending.get(id);
      if (!entry) return;
      pending.delete(id);
      if (ok) {
        entry.resolve(payload);
      } else {
        entry.reject(new Error(typeof payload === 'string' ? payload : 'ssc_translate_failed'));
      }
    };
  }

  function invoke(method, args) {
    return new Promise(function (resolve, reject) {
      if (!bridge.invoke) {
        reject(new Error('ssc_native_bridge_missing'));
        return;
      }
      var id = String(nextId++);
      bridge._nextId = nextId;
      pending.set(id, { resolve: resolve, reject: reject });
      bridge.invoke(method, id, JSON.stringify(args || {}));
    });
  }

  window.sscTranslate = {
    __sscNative: true,
    get available() {
      return true;
    },
    availability: function (source, target) {
      return invoke('translateAvailability', { source: source, target: target });
    },
    translate: function (text, source, target) {
      return invoke('translate', { text: text, source: source || 'auto', target: target });
    },
  };
})();