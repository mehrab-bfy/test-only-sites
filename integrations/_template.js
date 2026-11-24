/*
 * Integration template. Copy to integrations/<vendor>.js, fill it in, and add the file to manifest.js.
 *
 * Every hook gets a `ctx` object:
 *   ctx.page        'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thankyou' | 'notFound'
 *   ctx.params      route params, e.g. { id, category, variant }
 *   ctx.product     current product (product pages), with .id, .title, .price, .variants
 *   ctx.variant     current variant (product pages), with .id, .name
 *   ctx.settings    this integration's settings (defaults below + overrides saved in the Tester panel)
 *   ctx.consent     { analytics, marketing, decided }
 *   ctx.cart        cart lines [{ productId, variantId, title, price, qty }]
 *   ctx.log(msg, data, level)   writes to the Tester panel log ('info' | 'warn' | 'error')
 *   ctx.loadScript(src, attrs)  loads another script once, returns a Promise
 * Extra fields per hook: addToCart → ctx.qty; purchase → ctx.order; cartChange → ctx.cart.
 *
 * Hooks may return a Promise. Errors are caught and logged, so one broken vendor can't break the page.
 */
(function () {
  'use strict';

  window.TestStore.registerIntegration({
    id: 'my-vendor',                 // unique, used in URLs: ?enable=my-vendor / ?disable=my-vendor
    name: 'My Vendor',
    description: 'What this script does.',
    enabledByDefault: false,
    pages: '*',                      // '*' or e.g. ['product', 'cart'] — limits hooks and slots

    // Defaults; each can be overridden from the Tester panel without editing code.
    settings: {
      sdkUrl: '',
      apiKey: ''
    },

    // External scripts to load (in order) before init. Can be an array or a function of settings.
    // Use { inline: '...' } for a vendor's inline bootstrap snippet.
    scripts: function (s) { return s.sdkUrl ? [{ src: s.sdkUrl, attrs: { async: true } }] : []; },

    // Optional: runs before scripts load (e.g. set a global config object the SDK reads).
    beforeLoad: function (ctx) {
      // window.MyVendorConfig = { key: ctx.settings.apiKey };
    },

    // HTML injected into named slots. Value can be a string or function(settings, ctx).
    // Slots: global-top, global-bottom, home-top, home-bottom, category-top, category-bottom,
    // product-top, product-media-after, product-info-before-cart, product-info-after, product-bottom,
    // cart-bottom, checkout-top, checkout-bottom, thankyou-bottom
    slots: {
      'product-info-after': '<div id="my-vendor-widget"></div>'
    },

    hooks: {
      init: function (ctx) { /* once, after scripts load */ },
      pageEnter: function (ctx) { /* every route change, after the page renders */ },
      pageLeave: function (ctx) { /* before the next page renders — clean up here */ },
      variantChange: function (ctx) { /* product page variant picked */ },
      consentChange: function (ctx) { /* consent banner changed */ },
      addToCart: function (ctx) { /* ctx.product, ctx.variant, ctx.qty */ },
      cartChange: function (ctx) { /* ctx.cart */ },
      purchase: function (ctx) { /* ctx.order = { id, total, items, email } */ }
    }
  });
})();
