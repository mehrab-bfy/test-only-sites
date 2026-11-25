/*
 * Trialhood — virtual try-on viewer on product pages.
 *
 * Follows Trialhood's single-page-app pattern:
 *   mount once when a product page opens  -> Trialhood.mount({...})
 *   variant picker changes                -> instance.update({ variantId })
 *   consent banner changes                -> instance.setConsent({ analytics })
 *   leaving the product page              -> instance.destroy()
 *
 * Settings (editable in the Tester panel → Integrations → Trialhood → Settings):
 *   sdkUrl            URL of the Trialhood loader script. Set to "mocks/trialhood-mock.js" to use the fake SDK,
 *                     or empty if the SDK is loaded some other way.
 *   minHeight         Space reserved for the viewer so the page does not shift ('' to disable).
 *   storeId           Default Trialhood store ID (a product can set its own in catalog.js).
 *   storeOverride     Force this storeId on every product page (empty = per-product / default).
 *   target            CSS selector of the mount element (the slot below the product image).
 *   productOverride   Force this productId on every product page (empty = use the store's product id).
 *   variantOverride   Force this variantId (empty = use the selected variant id).
 *   readyTimeoutMs    How long to wait for window.Trialhood / "trialhood:ready" before logging a warning.
 */
(function () {
  'use strict';

  var trialhood = null;   // the mounted instance
  var mountToken = 0;     // guards against a page change while mount() is still resolving

  function whenReady(timeoutMs, log) {
    return new Promise(function (resolve) {
      if (window.Trialhood) return resolve();
      var warned = false;
      var timer = setTimeout(function () {
        warned = true;
        log('Still waiting for window.Trialhood / "trialhood:ready" after ' + timeoutMs + 'ms. Is sdkUrl set?', null, 'warn');
      }, timeoutMs);
      window.addEventListener('trialhood:ready', function () {
        clearTimeout(timer);
        if (warned) log('trialhood:ready arrived late');
        resolve();
      }, { once: true });
    });
  }

  // Precedence: tester-panel override → product's own `trialhood` block in catalog.js → defaults.
  // Products in catalog.js can set { trialhood: { storeId, productId } } and variants { trialhoodId }
  // when they belong to a different Trialhood store or use different IDs there.
  function ids(ctx) {
    var p = ctx.product.trialhood || {};
    return {
      storeId: ctx.settings.storeOverride || p.storeId || ctx.settings.storeId,
      productId: ctx.settings.productOverride || p.productId || ctx.product.id,
      variantId: ctx.settings.variantOverride || ctx.variant.trialhoodId || ctx.variant.id
    };
  }

  window.TestStore.registerIntegration({
    id: 'trialhood',
    name: 'Trialhood',
    description: 'Virtual try-on viewer mounted below the product image.',
    enabledByDefault: true,
    pages: ['product'],

    settings: {
      sdkUrl: 'https://cdn.trialhood.com/sdk/v1/loader.js',
      minHeight: '420px',
      storeId: 'st_98e038ef8da584a264adc0be',
      target: '#trialhood-product',
      storeOverride: '',
      productOverride: '',
      variantOverride: '',
      readyTimeoutMs: 8000
    },

    scripts: function (s) { return s.sdkUrl ? [{ src: s.sdkUrl, attrs: { crossorigin: 'anonymous' } }] : []; },

    // Space is reserved up front (as Trialhood recommends) so the page does not shift when the viewer loads.
    slots: {
      'product-media-after': function (s) {
        return '<div id="' + s.target.replace(/^#/, '') + '" class="vendor-mount" data-vendor="trialhood"' +
          (s.minHeight ? ' style="min-height:' + s.minHeight + '"' : '') + '></div>';
      }
    },

    hooks: {
      init: function (ctx) {
        if (!ctx.settings.sdkUrl && !window.Trialhood) {
          ctx.log('No sdkUrl set. Add the Trialhood loader URL in Settings, or load it from Tester → Scripts.', null, 'warn');
        }
        // The SDK fires "trialhood:state" on the mount element (bubbles) with { state, reason, revision }.
        // States: loading | ready | unavailable | fallback | destroyed. Reasons explain why the viewer hid,
        // e.g. not_found (product/variant not in this store), kill_switch (session refused — often the
        // origin isn't allowed), load_error, timeout, quota.
        document.addEventListener('trialhood:state', function (e) {
          var d = e.detail || {};
          var bad = d.state === 'fallback' || d.state === 'unavailable';
          ctx.log('state: ' + d.state + (d.reason ? ' (' + d.reason + ')' : ''), d, bad ? 'warn' : 'info');
          if (d.state === 'ready' && trialhood && trialhood.diagnostics) ctx.log('diagnostics', trialhood.diagnostics());
        });
      },

      pageEnter: function (ctx) {
        if (ctx.page !== 'product' || !ctx.product) return;
        var token = ++mountToken;
        var opts = {
          target: ctx.settings.target,
          storeId: ids(ctx).storeId,
          productId: ids(ctx).productId,
          variantId: ids(ctx).variantId,
          consent: { analytics: !!ctx.consent.analytics }
        };
        return whenReady(ctx.settings.readyTimeoutMs, ctx.log).then(function () {
          if (token !== mountToken) return; // user already navigated away
          ctx.log('mount()', opts);
          return window.Trialhood.mount(opts).then(function (instance) {
            if (token !== mountToken) { instance && instance.destroy && instance.destroy(); return; }
            trialhood = instance;
            ctx.log('Mounted');
          });
        });
      },

      variantChange: function (ctx) {
        if (!trialhood) return;
        var next = { variantId: ids(ctx).variantId };
        ctx.log('update()', next);
        trialhood.update(next);
      },

      consentChange: function (ctx) {
        if (!trialhood) return;
        var next = { analytics: !!ctx.consent.analytics };
        ctx.log('setConsent()', next);
        trialhood.setConsent(next);
      },

      pageLeave: function (ctx) {
        mountToken++;
        if (!trialhood) return;
        ctx.log('destroy()');
        trialhood.destroy();
        trialhood = null;
      }
    }
  });

  // Handy from the console: TestStore.trialhood()
  window.TestStore.trialhood = function () { return trialhood; };
})();
