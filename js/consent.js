/*
 * Minimal consent banner. Calls the `consentChange` hook on every integration when it changes.
 * Categories: analytics, marketing. "necessary" is always on.
 */
(function () {
  'use strict';
  var TS = window.TestStore;

  var consent = {
    get: function () { return TS.store.get('consent', { analytics: false, marketing: false, decided: false }); },
    set: function (next) {
      var value = { analytics: !!next.analytics, marketing: !!next.marketing, decided: true };
      TS.store.set('consent', value);
      TS.log('consent', 'Consent changed', value);
      TS.emit('consent-changed', value);
      TS.callHook('consentChange', { consent: value });
      hideBanner();
    },
    reset: function () { TS.store.remove('consent'); showBanner(); }
  };

  function hideBanner() {
    var el = document.getElementById('consent-banner');
    if (el) el.remove();
  }

  function showBanner() {
    hideBanner();
    var c = consent.get();
    var el = document.createElement('div');
    el.id = 'consent-banner';
    el.className = 'consent-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cookie settings');
    el.innerHTML =
      '<div><strong>Cookie settings (test)</strong><p class="small">Choose what integrations may track. Integrations get a <code>consentChange</code> hook.</p>' +
      '<label><input type="checkbox" id="cb-analytics"' + (c.analytics ? ' checked' : '') + '> Analytics</label> ' +
      '<label><input type="checkbox" id="cb-marketing"' + (c.marketing ? ' checked' : '') + '> Marketing</label></div>' +
      '<div class="row"><button class="btn" data-c="reject">Reject all</button>' +
      '<button class="btn" data-c="save">Save choices</button>' +
      '<button class="btn primary" data-c="accept">Accept all</button></div>';
    el.addEventListener('click', function (e) {
      var a = e.target.getAttribute('data-c');
      if (a === 'reject') consent.set({ analytics: false, marketing: false });
      if (a === 'accept') consent.set({ analytics: true, marketing: true });
      if (a === 'save') consent.set({
        analytics: el.querySelector('#cb-analytics').checked,
        marketing: el.querySelector('#cb-marketing').checked
      });
    });
    document.body.appendChild(el);
  }

  consent.showBanner = showBanner;
  TS.consent = consent;

  // Banner can be suppressed for clean screenshots: ?consent=hide
  document.addEventListener('DOMContentLoaded', function () {
    if (!consent.get().decided && TS.qs('consent') !== 'hide') showBanner();
  });
})();
