/*
 * Messavo — placeholder. Disabled by default until we have its embed script.
 *
 * To wire it up: set `sdkUrl` (and any IDs) below or in Tester → Integrations → Messavo → Settings,
 * enable it, then fill in the hooks with the calls from Messavo's install snippet.
 */
(function () {
  'use strict';

  window.TestStore.registerIntegration({
    id: 'messavo',
    name: 'Messavo',
    description: 'Placeholder — add the Messavo embed script and IDs.',
    enabledByDefault: false,
    pages: '*',

    settings: {
      sdkUrl: '',
      storeId: ''
    },

    scripts: function (s) { return s.sdkUrl ? [{ src: s.sdkUrl }] : []; },

    // Example mount points; rename or remove once the real embed is known.
    slots: {
      'product-info-after': '<div id="messavo-product" class="vendor-mount" data-vendor="messavo"></div>',
      'global-bottom': '<div id="messavo-global" data-vendor="messavo"></div>'
    },

    hooks: {
      init: function (ctx) {
        if (!ctx.settings.sdkUrl) ctx.log('No sdkUrl set yet.', null, 'warn');
      },
      pageEnter: function (ctx) { ctx.log('pageEnter', { page: ctx.page, productId: ctx.product && ctx.product.id }); },
      variantChange: function (ctx) { ctx.log('variantChange', { variantId: ctx.variant.id }); },
      addToCart: function (ctx) { ctx.log('addToCart', { variantId: ctx.variant.id, qty: ctx.qty }); },
      purchase: function (ctx) { ctx.log('purchase', ctx.order); },
      consentChange: function (ctx) { ctx.log('consentChange', ctx.consent); },
      pageLeave: function (ctx) { ctx.log('pageLeave', { page: ctx.page }); }
    }
  });
})();
