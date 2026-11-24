/*
 * Test Store core: storage, logging, script loading, and the integration registry.
 * Everything hangs off window.TestStore so integrations and the console can reach it.
 */
(function () {
  'use strict';

  var PREFIX = 'ts.';

  // ---------- storage ----------
  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    remove: function (key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    },
    clearAll: function () {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k);
      });
    }
  };

  // ---------- event bus + log ----------
  var listeners = {};
  var logEntries = [];
  var MAX_LOG = 500;

  function on(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }
  function emit(type, detail) {
    (listeners[type] || []).slice().forEach(function (fn) {
      try { fn(detail); } catch (e) { console.error(e); }
    });
  }

  function log(source, message, data, level) {
    var entry = {
      time: new Date(),
      source: source,
      message: message,
      data: data,
      level: level || 'info'
    };
    logEntries.push(entry);
    if (logEntries.length > MAX_LOG) logEntries.shift();
    var fn = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log;
    fn.call(console, '[' + source + '] ' + message, data === undefined ? '' : data);
    emit('log', entry);
  }

  // Record every CustomEvent dispatched on window (e.g. "trialhood:ready").
  var origDispatch = window.dispatchEvent.bind(window);
  window.dispatchEvent = function (evt) {
    if (evt && evt.type && evt.type.indexOf(':') > -1) {
      log('window-event', evt.type, evt.detail);
    }
    return origDispatch(evt);
  };
  window.addEventListener('error', function (e) {
    log('page', 'Uncaught error: ' + e.message, { file: e.filename, line: e.lineno }, 'error');
  });
  window.addEventListener('unhandledrejection', function (e) {
    log('page', 'Unhandled promise rejection', String(e.reason && (e.reason.stack || e.reason)), 'error');
  });

  // ---------- script loader ----------
  var loaded = {};
  function loadScript(src, attrs) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === 'async' || k === 'defer') s[k] = !!attrs[k];
        else s.setAttribute(k, attrs[k]);
      });
      s.onload = function () { log('loader', 'Loaded ' + src); resolve(s); };
      s.onerror = function () {
        log('loader', 'Failed to load ' + src, null, 'error');
        delete loaded[src];
        reject(new Error('Failed to load ' + src));
      };
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  function runInline(code, label) {
    var s = document.createElement('script');
    s.textContent = code + '\n//# sourceURL=' + (label || 'inline-script').replace(/\s+/g, '-') + '.js';
    document.head.appendChild(s);
    log('loader', 'Ran inline script: ' + (label || 'inline'));
  }

  // ---------- integrations ----------
  var integrations = [];
  var HOOKS = ['init', 'pageEnter', 'pageLeave', 'variantChange', 'consentChange', 'cartChange', 'addToCart', 'purchase'];

  function registerIntegration(def) {
    if (!def || !def.id) throw new Error('Integration needs an id');
    if (integrations.some(function (i) { return i.id === def.id; })) {
      log('core', 'Integration "' + def.id + '" registered twice; ignoring the second one', null, 'warn');
      return;
    }
    def.hooks = def.hooks || {};
    def.status = 'registered';
    integrations.push(def);
    log('core', 'Registered integration ' + def.id);
  }

  function isEnabled(i) {
    var override = store.get('integration.' + i.id + '.enabled', null);
    return override === null ? !!i.enabledByDefault : !!override;
  }
  function setEnabled(id, value) { store.set('integration.' + id + '.enabled', !!value); }

  function getSettings(i) {
    var saved = store.get('integration.' + i.id + '.settings', {});
    var merged = {};
    Object.keys(i.settings || {}).forEach(function (k) { merged[k] = i.settings[k]; });
    Object.keys(saved).forEach(function (k) { merged[k] = saved[k]; });
    return merged;
  }
  function saveSettings(id, obj) { store.set('integration.' + id + '.settings', obj); }
  function resetSettings(id) { store.remove('integration.' + id + '.settings'); }

  function enabledIntegrations() { return integrations.filter(isEnabled); }

  function pageMatches(i, page) {
    if (!i.pages || i.pages === '*' ) return true;
    return i.pages.indexOf(page) > -1;
  }

  // Build the context object every hook receives.
  function makeContext(i, extra) {
    var ctx = {
      integration: i.id,
      settings: getSettings(i),
      consent: TestStore.consent ? TestStore.consent.get() : {},
      cart: TestStore.cart ? TestStore.cart.items() : [],
      log: function (msg, data, level) { log(i.id, msg, data, level); },
      loadScript: loadScript,
      store: TestStore
    };
    var route = TestStore.currentRoute || {};
    ctx.page = route.page;
    ctx.params = route.params || {};
    ctx.product = route.product || null;
    ctx.variant = route.variant || null;
    Object.keys(extra || {}).forEach(function (k) { ctx[k] = extra[k]; });
    return ctx;
  }

  function callHook(name, extra, onlyPage) {
    return Promise.all(enabledIntegrations().map(function (i) {
      var fn = i.hooks[name];
      if (typeof fn !== 'function') return null;
      if (i.status === 'failed' && name !== 'init') return null;
      if (onlyPage && !pageMatches(i, onlyPage)) return null;
      var ctx = makeContext(i, extra);
      return Promise.resolve()
        .then(function () { return fn.call(i, ctx); })
        .catch(function (e) { log(i.id, 'Hook ' + name + ' threw: ' + e.message, e.stack, 'error'); });
    }));
  }

  // Load each enabled integration's external scripts, then run init.
  function bootIntegrations() {
    return Promise.all(enabledIntegrations().map(function (i) {
      var settings = getSettings(i);
      var scripts = typeof i.scripts === 'function' ? i.scripts(settings) : (i.scripts || []);
      i.status = 'loading';
      return Promise.resolve()
        .then(function () { return typeof i.beforeLoad === 'function' ? i.beforeLoad(makeContext(i)) : null; })
        .then(function () {
          // Scripts load in order: later ones may depend on earlier ones.
          return scripts.reduce(function (p, sc) {
            return p.then(function () {
              if (sc.inline) return runInline(sc.inline, i.id);
              if (!sc.src) return null;
              return loadScript(sc.src, sc.attrs);
            });
          }, Promise.resolve());
        })
        .then(function () {
          if (typeof i.hooks.init === 'function') return i.hooks.init.call(i, makeContext(i));
        })
        .then(function () { i.status = 'ready'; log(i.id, 'Ready'); })
        .catch(function (e) { i.status = 'failed'; log(i.id, 'Boot failed: ' + e.message, null, 'error'); });
    }));
  }

  // Render integration slot markup into a container (e.g. a product page).
  function renderSlots(root, page) {
    var nodes = (root || document).querySelectorAll('[data-slot]');
    Array.prototype.forEach.call(nodes, function (node) {
      var name = node.getAttribute('data-slot');
      var html = '';
      enabledIntegrations().forEach(function (i) {
        if (!i.slots || !i.slots[name] || !pageMatches(i, page)) return;
        var s = i.slots[name];
        var out = typeof s === 'function' ? s(getSettings(i), makeContext(i)) : s;
        if (out) html += '<div class="slot-item" data-integration="' + i.id + '">' + out + '</div>';
      });
      node.innerHTML = html;
    });
  }

  // ---------- helpers ----------
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function esc(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) { return '$' + Number(n).toFixed(2); }

  // URL switches: ?enable=a,b&disable=c (persisted), ?reset=1 (clears all saved test state)
  (function applyUrlSwitches() {
    if (qs('reset') === '1') store.clearAll();
    (qs('enable') || '').split(',').filter(Boolean).forEach(function (id) { setEnabled(id.trim(), true); });
    (qs('disable') || '').split(',').filter(Boolean).forEach(function (id) { setEnabled(id.trim(), false); });
  })();

  window.TestStore = {
    version: '1.0.0',
    store: store,
    on: on,
    emit: emit,
    log: log,
    logEntries: function () { return logEntries.slice(); },
    clearLog: function () { logEntries.length = 0; emit('log-cleared'); },
    loadScript: loadScript,
    runInline: runInline,
    registerIntegration: registerIntegration,
    integrations: function () { return integrations.slice(); },
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    getSettings: getSettings,
    saveSettings: saveSettings,
    resetSettings: resetSettings,
    callHook: callHook,
    bootIntegrations: bootIntegrations,
    renderSlots: renderSlots,
    qs: qs,
    esc: esc,
    money: money,
    currentRoute: null
  };
})();
