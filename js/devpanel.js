/*
 * Tester panel: toggle integrations, edit their settings, paste ad-hoc scripts, watch the event log.
 * Everything here is saved in localStorage under "ts.*" so it survives reloads. ?reset=1 clears it.
 */
(function () {
  'use strict';
  var TS = window.TestStore;
  var esc = TS.esc;

  // ---------- ad-hoc scripts ----------
  // { id, name, type: 'src'|'inline', value, runOn: 'boot'|'page', pages: '*' | 'product,cart', enabled }
  var customScripts = {
    list: function () { return TS.store.get('customScripts', []); },
    save: function (list) { TS.store.set('customScripts', list); },
    matches: function (s, page) {
      if (!s.pages || s.pages.trim() === '*' || s.pages.trim() === '') return true;
      return s.pages.split(',').map(function (x) { return x.trim(); }).indexOf(page) > -1;
    },
    run: function (s) {
      if (s.type === 'src') {
        // Re-running a src script on each page means re-adding the tag, so bypass the loader cache.
        var el = document.createElement('script');
        el.src = s.value;
        el.async = true;
        el.onload = function () { TS.log('custom:' + s.name, 'Loaded ' + s.value); };
        el.onerror = function () { TS.log('custom:' + s.name, 'Failed to load ' + s.value, null, 'error'); };
        document.head.appendChild(el);
      } else {
        TS.runInline(s.value, 'custom-' + s.name);
      }
    },
    runFor: function (when, page) {
      customScripts.list().forEach(function (s) {
        if (s.enabled && s.runOn === when && customScripts.matches(s, page)) customScripts.run(s);
      });
    }
  };
  TS.customScripts = customScripts;

  // ---------- panel UI ----------
  var panel, activeTab = TS.store.get('panelTab', 'integrations');

  function open() { build(); panel.classList.add('open'); TS.store.set('panelOpen', true); render(); }
  function close() { if (panel) panel.classList.remove('open'); TS.store.set('panelOpen', false); }
  function toggle() { panel && panel.classList.contains('open') ? close() : open(); }

  function build() {
    if (panel) return;
    panel = document.createElement('aside');
    panel.id = 'devpanel';
    panel.className = 'devpanel';
    panel.setAttribute('aria-label', 'Tester panel');
    panel.innerHTML =
      '<div class="dp-head"><strong>Tester panel</strong><button class="dp-x" data-dp="close" aria-label="Close">×</button></div>' +
      '<div class="dp-tabs" role="tablist">' +
      ['integrations', 'scripts', 'context', 'log', 'settings'].map(function (t) {
        return '<button role="tab" data-tab="' + t + '">' + t + '</button>';
      }).join('') + '</div><div class="dp-body"></div>';
    document.body.appendChild(panel);

    panel.addEventListener('click', onClick);
    panel.addEventListener('change', onChange);
    TS.on('log', function (entry) { if (activeTab === 'log' && panel.classList.contains('open')) appendLog(entry); });
    TS.on('log-cleared', function () { if (activeTab === 'log') render(); });
    TS.on('route', function () { if (activeTab === 'context' && panel.classList.contains('open')) render(); });
    TS.on('booted', function () { if (activeTab !== 'log' && panel.classList.contains('open')) render(); });
  }

  function render() {
    Array.prototype.forEach.call(panel.querySelectorAll('[data-tab]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === activeTab);
    });
    var body = panel.querySelector('.dp-body');
    body.innerHTML = tabs[activeTab]();
    if (activeTab === 'log') {
      var box = body.querySelector('.dp-log');
      TS.logEntries().forEach(function (e) { box.appendChild(logRow(e)); });
      box.scrollTop = box.scrollHeight;
    }
  }

  function logRow(e) {
    var row = document.createElement('div');
    row.className = 'dp-log-row ' + e.level;
    var data = e.data === undefined || e.data === null ? '' : (typeof e.data === 'string' ? e.data : safeJson(e.data));
    row.innerHTML = '<span class="t">' + e.time.toLocaleTimeString() + '</span> <span class="s">' + esc(e.source) + '</span> ' +
      esc(e.message) + (data ? '<pre>' + esc(data) + '</pre>' : '');
    return row;
  }
  function appendLog(e) {
    var box = panel.querySelector('.dp-log');
    if (!box) return;
    box.appendChild(logRow(e));
    box.scrollTop = box.scrollHeight;
  }
  function safeJson(v) { try { return JSON.stringify(v, null, 2); } catch (e) { return String(v); } }

  var tabs = {
    integrations: function () {
      var list = TS.integrations();
      if (!list.length) return '<p>No integrations registered. Add one in <code>integrations/</code>.</p>';
      return '<p class="small muted">Toggles and settings apply after reload.</p>' + list.map(function (i) {
        var on = TS.isEnabled(i);
        return '<div class="dp-card">' +
          '<div class="row between"><label class="switch"><input type="checkbox" data-int-toggle="' + esc(i.id) + '"' + (on ? ' checked' : '') + '> <strong>' + esc(i.name || i.id) + '</strong></label>' +
          '<span class="pill ' + esc(on ? i.status : 'off') + '">' + esc(on ? i.status : 'disabled') + '</span></div>' +
          (i.description ? '<div class="small muted">' + esc(i.description) + '</div>' : '') +
          '<details><summary>Settings</summary><textarea class="mono" rows="8" data-int-settings="' + esc(i.id) + '">' + esc(safeJson(TS.getSettings(i))) + '</textarea>' +
          '<div class="row"><button class="btn sm primary" data-int-save="' + esc(i.id) + '">Save &amp; reload</button>' +
          '<button class="btn sm" data-int-reset="' + esc(i.id) + '">Reset to defaults</button></div></details></div>';
      }).join('') + '<button class="btn sm" data-dp="reload">Reload page</button>';
    },

    scripts: function () {
      var list = customScripts.list();
      return '<p class="small muted">Paste a script URL or inline JS. "Each page" runs it on every route change (SPA); "boot" runs once on load. Pages: <code>*</code> or a list such as <code>product,cart</code>.</p>' +
        list.map(function (s, idx) {
          return '<div class="dp-card"><div class="row between"><label class="switch"><input type="checkbox" data-cs-toggle="' + idx + '"' + (s.enabled ? ' checked' : '') + '> <strong>' + esc(s.name) + '</strong></label>' +
            '<span class="small muted">' + esc(s.type) + ' · ' + esc(s.runOn) + ' · ' + esc(s.pages || '*') + '</span></div>' +
            '<pre class="dp-code">' + esc(s.value.length > 300 ? s.value.slice(0, 300) + '…' : s.value) + '</pre>' +
            '<div class="row"><button class="btn sm" data-cs-run="' + idx + '">Run now</button><button class="btn sm" data-cs-edit="' + idx + '">Edit</button><button class="btn sm" data-cs-del="' + idx + '">Delete</button></div></div>';
        }).join('') +
        '<div class="dp-card"><strong id="cs-form-title">Add script</strong>' +
        '<input type="hidden" id="cs-idx" value="">' +
        '<label>Name<input id="cs-name" placeholder="my-widget"></label>' +
        '<label>Type<select id="cs-type"><option value="inline">Inline JS</option><option value="src">Script URL</option></select></label>' +
        '<label>Code or URL<textarea id="cs-value" class="mono" rows="8" placeholder="console.log(\'hello\')"></textarea></label>' +
        '<label>Run on<select id="cs-runon"><option value="boot">Boot (once per load)</option><option value="page">Each page change</option></select></label>' +
        '<label>Pages<input id="cs-pages" value="*"></label>' +
        '<div class="row"><button class="btn sm primary" data-dp="cs-save">Save</button><button class="btn sm" data-dp="cs-save-run">Save &amp; run now</button></div></div>';
    },

    context: function () {
      var r = TS.currentRoute || {};
      var ctx = {
        page: r.page,
        params: r.params,
        productId: r.product && r.product.id,
        variantId: r.variant && r.variant.id,
        consent: TS.consent.get(),
        cart: TS.cart.items(),
        navigationMode: TS.store.get('navMode', 'spa'),
        enabledIntegrations: TS.integrations().filter(TS.isEnabled).map(function (i) { return i.id; })
      };
      return '<p class="small muted">What integrations see right now.</p><pre class="dp-code">' + esc(safeJson(ctx)) + '</pre>' +
        '<div class="row"><button class="btn sm" data-dp="copy-context">Copy</button>' +
        '<button class="btn sm" data-dp="consent-banner">Show consent banner</button></div>';
    },

    log: function () {
      return '<div class="row"><button class="btn sm" data-dp="clear-log">Clear</button><button class="btn sm" data-dp="copy-log">Copy all</button></div><div class="dp-log"></div>';
    },

    settings: function () {
      var mode = TS.store.get('navMode', 'spa');
      return '<div class="dp-card"><strong>Navigation mode</strong>' +
        '<p class="small muted">SPA: route changes without reload (tests mount/update/destroy). Full reload: every navigation reloads the page (tests scripts as on a classic multi-page site).</p>' +
        '<label><input type="radio" name="navmode" value="spa"' + (mode === 'spa' ? ' checked' : '') + '> SPA</label> ' +
        '<label><input type="radio" name="navmode" value="reload"' + (mode === 'reload' ? ' checked' : '') + '> Full reload</label></div>' +
        '<div class="dp-card"><strong>Add a test product</strong><p class="small muted">JSON with id, title, category, price and variants [{id, name, color}].</p>' +
        '<textarea id="np-json" class="mono" rows="8">' + esc(safeJson({ id: 'MY_PRODUCT_ID', title: 'My test product', brand: 'Vendor', category: 'eyewear', price: 99, description: '', tags: [], variants: [{ id: 'MY_VARIANT_ID', name: 'Default', color: '#334455' }] })) + '</textarea>' +
        '<div class="row"><button class="btn sm primary" data-dp="np-add">Add product</button><button class="btn sm" data-dp="np-clear">Remove added products</button></div>' +
        '<div class="small muted">Added: ' + TS.store.get('customProducts', []).map(function (p) { return '<a href="#/product/' + encodeURIComponent(p.id) + '">' + esc(p.id) + '</a>'; }).join(', ') + '</div></div>' +
        '<div class="dp-card"><strong>Reset</strong><p class="small muted">Clears cart, consent, toggles, settings, scripts and added products.</p>' +
        '<button class="btn sm danger" data-dp="reset-all">Reset all test state</button></div>' +
        '<p class="small muted">Version ' + esc(TS.version) + '</p>';
    }
  };

  function onClick(e) {
    var t = e.target;
    var tab = t.getAttribute('data-tab');
    if (tab) { activeTab = tab; TS.store.set('panelTab', tab); render(); return; }

    var a = t.getAttribute('data-dp');
    if (a === 'close') close();
    if (a === 'reload') location.reload();
    if (a === 'clear-log') TS.clearLog();
    if (a === 'copy-log') copy(TS.logEntries().map(function (x) { return x.time.toISOString() + ' [' + x.source + '] ' + x.message + (x.data ? ' ' + safeJson(x.data) : ''); }).join('\n'));
    if (a === 'copy-context') copy(panel.querySelector('.dp-code').textContent);
    if (a === 'consent-banner') TS.consent.showBanner();
    if (a === 'reset-all' && confirm('Reset all saved test state?')) { TS.store.clearAll(); location.reload(); }
    if (a === 'np-add') {
      try {
        var p = JSON.parse(panel.querySelector('#np-json').value);
        if (!p.id || !p.variants || !p.variants.length) throw new Error('Need id and at least one variant');
        var list = TS.store.get('customProducts', []).filter(function (x) { return x.id !== p.id; });
        list.push(p);
        TS.store.set('customProducts', list);
        location.hash = '#/product/' + encodeURIComponent(p.id);
        render();
      } catch (err) { alert('Invalid product JSON: ' + err.message); }
    }
    if (a === 'np-clear') { TS.store.remove('customProducts'); render(); }
    if (a === 'cs-save' || a === 'cs-save-run') {
      var s = {
        name: panel.querySelector('#cs-name').value.trim() || 'script',
        type: panel.querySelector('#cs-type').value,
        value: panel.querySelector('#cs-value').value,
        runOn: panel.querySelector('#cs-runon').value,
        pages: panel.querySelector('#cs-pages').value.trim() || '*',
        enabled: true
      };
      if (!s.value.trim()) { alert('Add some code or a URL first.'); return; }
      var scripts = customScripts.list();
      var idx = panel.querySelector('#cs-idx').value;
      if (idx !== '') scripts[Number(idx)] = s; else scripts.push(s);
      customScripts.save(scripts);
      if (a === 'cs-save-run') customScripts.run(s);
      render();
    }

    var n;
    if ((n = t.getAttribute('data-cs-run')) !== null) customScripts.run(customScripts.list()[Number(n)]);
    if ((n = t.getAttribute('data-cs-del')) !== null) {
      var l = customScripts.list(); l.splice(Number(n), 1); customScripts.save(l); render();
    }
    if ((n = t.getAttribute('data-cs-edit')) !== null) {
      var cs = customScripts.list()[Number(n)];
      panel.querySelector('#cs-idx').value = n;
      panel.querySelector('#cs-form-title').textContent = 'Edit script';
      panel.querySelector('#cs-name').value = cs.name;
      panel.querySelector('#cs-type').value = cs.type;
      panel.querySelector('#cs-value').value = cs.value;
      panel.querySelector('#cs-runon').value = cs.runOn;
      panel.querySelector('#cs-pages').value = cs.pages;
      panel.querySelector('#cs-name').focus();
    }
    if ((n = t.getAttribute('data-int-save')) !== null) {
      try {
        TS.saveSettings(n, JSON.parse(panel.querySelector('[data-int-settings="' + n + '"]').value));
        location.reload();
      } catch (err) { alert('Settings must be valid JSON: ' + err.message); }
    }
    if ((n = t.getAttribute('data-int-reset')) !== null) { TS.resetSettings(n); location.reload(); }
  }

  function onChange(e) {
    var t = e.target, n;
    if ((n = t.getAttribute('data-int-toggle')) !== null) { TS.setEnabled(n, t.checked); render(); }
    if ((n = t.getAttribute('data-cs-toggle')) !== null) {
      var l = customScripts.list(); l[Number(n)].enabled = t.checked; customScripts.save(l);
    }
    if (t.name === 'navmode') { TS.store.set('navMode', t.value); TS.log('settings', 'Navigation mode: ' + t.value); }
  }

  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { TS.log('panel', 'Copied to clipboard'); });
  }

  // Floating launcher
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.createElement('button');
    btn.className = 'dp-launcher';
    btn.textContent = 'Tester';
    btn.setAttribute('aria-label', 'Open tester panel');
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);
    if (TS.store.get('panelOpen', false) || TS.qs('panel') === '1') TS.integrationsLoaded.then(open);
  });

  TS.devpanel = { open: open, close: close, toggle: toggle };
})();
