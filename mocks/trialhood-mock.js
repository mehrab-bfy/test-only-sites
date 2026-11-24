/*
 * Fake Trialhood SDK for checking the store's wiring without the real one.
 * Same surface: window.Trialhood.mount(opts) → Promise<instance{update,setConsent,destroy}>,
 * and a "trialhood:ready" event on window.
 * Use it by setting Trialhood sdkUrl to "mocks/trialhood-mock.js" in the tester panel.
 */
(function () {
  'use strict';
  function box(el, state) {
    el.innerHTML = '<div style="border:2px dashed #1f4fd1;border-radius:10px;padding:14px;font:13px/1.5 ui-monospace,Consolas,monospace;background:#f3f6ff">' +
      '<strong>Trialhood MOCK viewer</strong><br>store: ' + state.storeId + '<br>product: ' + state.productId +
      '<br>variant: ' + state.variantId + '<br>analytics consent: ' + state.consent.analytics +
      '<br>updates: ' + state.updates + '</div>';
  }
  window.Trialhood = {
    mock: true,
    mount: function (opts) {
      return new Promise(function (resolve, reject) {
        var el = document.querySelector(opts.target);
        if (!el) return reject(new Error('Trialhood mock: target ' + opts.target + ' not found'));
        var state = { storeId: opts.storeId, productId: opts.productId, variantId: opts.variantId, consent: opts.consent || {}, updates: 0 };
        setTimeout(function () {
          box(el, state);
          resolve({
            update: function (p) { Object.assign(state, p); state.updates++; box(el, state); },
            setConsent: function (c) { state.consent = Object.assign({}, state.consent, c); box(el, state); },
            destroy: function () { el.innerHTML = ''; }
          });
        }, 150);
      });
    }
  };
  setTimeout(function () { window.dispatchEvent(new CustomEvent('trialhood:ready')); }, 50);
})();
