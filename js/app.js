/*
 * Hash router + boot sequence.
 *
 * Boot: load integration files → render first page (so mount elements exist) → load vendor SDKs + init
 *       → run "boot" custom scripts → pageEnter hooks.
 * Navigation (SPA mode): pageLeave hooks → render → pageEnter hooks → "each page" custom scripts.
 * Variant change on a product page does not re-render: it calls variantChange hooks.
 */
(function () {
  'use strict';
  var TS = window.TestStore;
  var app = document.getElementById('app');
  var booted = false;

  function parseHash() {
    var raw = location.hash.replace(/^#/, '') || '/';
    var qIndex = raw.indexOf('?');
    var path = qIndex > -1 ? raw.slice(0, qIndex) : raw;
    var query = new URLSearchParams(qIndex > -1 ? raw.slice(qIndex + 1) : '');
    var parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    var route = { path: path, params: {}, product: null, variant: null };

    if (!parts.length) route.page = 'home';
    else if (parts[0] === 'category' && parts[1]) { route.page = 'category'; route.params.category = parts[1]; }
    else if (parts[0] === 'product' && parts[1]) {
      route.page = 'product';
      route.params.id = parts[1];
      route.params.variant = query.get('variant') || '';
      route.product = TS.catalog.find(parts[1]);
      route.variant = TS.catalog.findVariant(route.product, route.params.variant);
      if (!route.product) route.page = 'notFound';
    }
    else if (parts[0] === 'cart') route.page = 'cart';
    else if (parts[0] === 'checkout') route.page = 'checkout';
    else if (parts[0] === 'thank-you') route.page = 'thankyou';
    else route.page = 'notFound';
    return route;
  }

  function render(route) {
    TS.currentRoute = route;
    app.innerHTML = TS.views[route.page](route);
    TS.renderSlots(app, route.page);
    document.title = titleFor(route) + ' — Test Store';
    window.scrollTo(0, 0);
    TS.emit('route', route);
  }

  function titleFor(r) {
    if (r.page === 'product' && r.product) return r.product.title;
    if (r.page === 'category') return r.params.category;
    return { home: 'Home', cart: 'Cart', checkout: 'Checkout', thankyou: 'Thank you', notFound: 'Not found' }[r.page] || r.page;
  }

  function enter(route) {
    TS.log('router', 'pageEnter ' + route.page, route.product ? { productId: route.product.id, variantId: route.variant.id } : undefined);
    return TS.callHook('pageEnter').then(function () { TS.customScripts.runFor('page', route.page); });
  }

  function navigate() {
    if (!booted) return;
    var next = parseHash();
    var prev = TS.currentRoute;

    // Same product, different variant → variant change instead of a new page.
    if (prev && prev.page === 'product' && next.page === 'product' && prev.product.id === next.product.id) {
      if (prev.variant.id !== next.variant.id) applyVariant(next.variant.id, false);
      return;
    }

    if (TS.store.get('navMode', 'spa') === 'reload') { location.reload(); return; }

    TS.log('router', 'pageLeave ' + (prev && prev.page));
    TS.callHook('pageLeave').then(function () {
      render(next);
      return enter(next);
    });
  }

  function applyVariant(variantId, updateUrl) {
    var r = TS.currentRoute;
    var v = TS.catalog.findVariant(r.product, variantId);
    if (!v || v.id === r.variant.id) return;
    r.variant = v;
    r.params.variant = v.id;
    if (updateUrl) history.replaceState(null, '', '#/product/' + encodeURIComponent(r.product.id) + '?variant=' + encodeURIComponent(v.id));
    var art = document.getElementById('pdp-art');
    if (art) art.innerHTML = TS.catalog.art(r.product, v);
    var vid = document.getElementById('vid');
    if (vid) vid.textContent = v.id;
    Array.prototype.forEach.call(app.querySelectorAll('.variant'), function (el) {
      el.classList.toggle('active', el.querySelector('input').value === v.id);
    });
    TS.log('router', 'variantChange', { productId: r.product.id, variantId: v.id });
    TS.callHook('variantChange');
  }

  // ---------- UI events ----------
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var a = el.getAttribute('data-action');
    if (a === 'open-devpanel') { e.preventDefault(); TS.devpanel.open(); }
    if (a === 'open-consent') { e.preventDefault(); TS.consent.showBanner(); }
    if (a === 'add-to-cart') {
      var r = TS.currentRoute;
      var qty = Math.max(1, parseInt(document.getElementById('qty').value, 10) || 1);
      TS.cart.add(r.product, r.variant, qty);
      el.textContent = 'Added ✓';
      setTimeout(function () { el.textContent = 'Add to cart'; }, 1200);
    }
    if (a === 'clear-cart') { TS.cart.clear(); render(TS.currentRoute); }
  });

  document.addEventListener('change', function (e) {
    if (e.target.name === 'variant' && app.contains(e.target)) applyVariant(e.target.value, true);
    var qtyFor = e.target.getAttribute('data-qty');
    if (qtyFor) { TS.cart.setQty(qtyFor, parseInt(e.target.value, 10) || 0); render(TS.currentRoute); }
  });

  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'checkout-form') return;
    e.preventDefault();
    var form = new FormData(e.target);
    var order = {
      id: 'TEST-' + Date.now().toString(36).toUpperCase(),
      total: TS.cart.total(),
      items: TS.cart.items(),
      email: form.get('email')
    };
    TS.store.set('lastOrder', order);
    TS.log('checkout', 'Test order placed', order);
    TS.callHook('purchase', { order: order }).then(function () {
      TS.cart.clear();
      location.hash = '#/thank-you';
    });
  });

  function updateCartCount() { document.getElementById('cart-count').textContent = TS.cart.count(); }
  TS.on('cart-changed', updateCartCount);

  window.addEventListener('hashchange', navigate);

  // ---------- boot ----------
  TS.integrationsLoaded.then(function () {
    updateCartCount();
    var first = parseHash();
    render(first);
    TS.renderSlots(document, first.page); // also fills global-top / global-bottom
    return TS.bootIntegrations();
  }).then(function () {
    TS.customScripts.runFor('boot', TS.currentRoute.page);
    booted = true;
    TS.log('router', 'Booted (' + TS.store.get('navMode', 'spa') + ' mode)');
    TS.emit('booted');
    return enter(TS.currentRoute);
  });

  // Console helpers
  TS.navigate = function (hash) { location.hash = hash; };
  TS.selectVariant = function (id) { applyVariant(id, true); };
})();
