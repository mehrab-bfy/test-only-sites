/*
 * Page templates. Each view returns HTML; `data-slot` elements are where integrations can inject markup.
 * Slots available: see README "Slots".
 */
(function () {
  'use strict';
  var TS = window.TestStore;
  var esc = TS.esc, money = TS.money;

  function card(p) {
    return '<a class="product-card" href="#/product/' + encodeURIComponent(p.id) + '">' +
      '<div class="product-art">' + TS.catalog.art(p) + '</div>' +
      '<div class="product-card-body"><div class="muted small">' + esc(p.brand) + '</div>' +
      '<div class="product-title">' + esc(p.title) + '</div>' +
      '<div class="price">' + money(p.price) + '</div>' +
      '<div class="muted small mono">' + esc(p.id) + '</div></div></a>';
  }

  var views = {
    home: function () {
      var featured = TS.catalog.products();
      return '<div data-slot="home-top"></div>' +
        '<section class="hero"><h1>Universal integration test store</h1>' +
        '<p>A neutral storefront for testing third-party scripts: try-on viewers, widgets, analytics and checkout add-ons. ' +
        'Open the <a href="#" data-action="open-devpanel">tester panel</a> to switch integrations, paste scripts and watch events.</p></section>' +
        '<h2>All products</h2><div class="grid">' + featured.map(card).join('') + '</div>' +
        '<div data-slot="home-bottom"></div>';
    },

    category: function (route) {
      var list = TS.catalog.products().filter(function (p) { return p.category === route.params.category; });
      return '<div data-slot="category-top"></div><h1 class="cap">' + esc(route.params.category) + '</h1>' +
        (list.length ? '<div class="grid">' + list.map(card).join('') + '</div>' : '<p>No products in this category.</p>') +
        '<div data-slot="category-bottom"></div>';
    },

    product: function (route) {
      var p = route.product, v = route.variant;
      if (!p) return views.notFound();
      var picker = p.variants.length > 1
        ? '<fieldset class="variants"><legend>Variant</legend>' + p.variants.map(function (x) {
            return '<label class="variant' + (x.id === v.id ? ' active' : '') + '">' +
              '<input type="radio" name="variant" value="' + esc(x.id) + '"' + (x.id === v.id ? ' checked' : '') + '>' +
              '<span class="swatch" style="background:' + esc(x.color || '#ccc') + '"></span>' + esc(x.name) + '</label>';
          }).join('') + '</fieldset>'
        : '';
      return '<div data-slot="product-top"></div>' +
        '<nav class="crumbs"><a href="#/">Home</a> / <a href="#/category/' + esc(p.category) + '" class="cap">' + esc(p.category) + '</a> / ' + esc(p.title) + '</nav>' +
        '<div class="pdp">' +
          '<div class="pdp-media">' +
            '<div class="product-art large" id="pdp-art">' + TS.catalog.art(p, v) + '</div>' +
            '<div data-slot="product-media-after"></div>' +
          '</div>' +
          '<div class="pdp-info">' +
            '<div class="muted">' + esc(p.brand) + '</div>' +
            '<h1>' + esc(p.title) + '</h1>' +
            '<div class="price large">' + money(v.price || p.price) + '</div>' +
            '<p>' + esc(p.description) + '</p>' +
            picker +
            '<div class="ids small mono">product: <span id="pid">' + esc(p.id) + '</span><br>variant: <span id="vid">' + esc(v.id) + '</span></div>' +
            '<div data-slot="product-info-before-cart"></div>' +
            '<div class="buy-row"><input type="number" id="qty" min="1" value="1" aria-label="Quantity">' +
            '<button class="btn primary" data-action="add-to-cart">Add to cart</button></div>' +
            '<div data-slot="product-info-after"></div>' +
          '</div>' +
        '</div>' +
        '<div data-slot="product-bottom"></div>';
    },

    cart: function () {
      var items = TS.cart.items();
      if (!items.length) return '<h1>Cart</h1><p>Your cart is empty. <a href="#/">Keep shopping</a>.</p><div data-slot="cart-bottom"></div>';
      return '<h1>Cart</h1><table class="cart-table"><thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead><tbody>' +
        items.map(function (i) {
          return '<tr><td><a href="#/product/' + encodeURIComponent(i.productId) + '?variant=' + encodeURIComponent(i.variantId) + '">' + esc(i.title) + '</a>' +
            '<div class="muted small">' + esc(i.variantName) + ' · <span class="mono">' + esc(i.variantId) + '</span></div></td>' +
            '<td>' + money(i.price) + '</td>' +
            '<td><input type="number" min="0" value="' + i.qty + '" data-qty="' + esc(i.variantId) + '" aria-label="Quantity"></td>' +
            '<td>' + money(i.price * i.qty) + '</td></tr>';
        }).join('') +
        '</tbody></table><div class="cart-summary"><div>Subtotal <strong>' + money(TS.cart.total()) + '</strong></div>' +
        '<div class="row"><button class="btn" data-action="clear-cart">Clear cart</button><a class="btn primary" href="#/checkout">Checkout</a></div></div>' +
        '<div data-slot="cart-bottom"></div>';
    },

    checkout: function () {
      var items = TS.cart.items();
      if (!items.length) return '<h1>Checkout</h1><p>Your cart is empty.</p>';
      return '<h1>Checkout</h1><div class="notice">Test checkout. No payment is taken. Use dummy details only.</div>' +
        '<div data-slot="checkout-top"></div>' +
        '<form id="checkout-form" class="form" autocomplete="off">' +
        '<label>Name<input name="name" required placeholder="Test Shopper"></label>' +
        '<label>Email<input name="email" type="email" required placeholder="shopper@example.test"></label>' +
        '<label>Address<input name="address" placeholder="1 Test Street"></label>' +
        '<div class="muted">Order total: <strong>' + money(TS.cart.total()) + '</strong></div>' +
        '<button class="btn primary" type="submit">Place test order</button></form>' +
        '<div data-slot="checkout-bottom"></div>';
    },

    thankyou: function (route) {
      var order = TS.store.get('lastOrder', null);
      return '<h1>Thanks — test order placed</h1>' +
        (order ? '<p>Order <span class="mono">' + esc(order.id) + '</span>, total ' + money(order.total) + '.</p>' : '') +
        '<p><a href="#/">Back to store</a></p><div data-slot="thankyou-bottom"></div>';
    },

    notFound: function () {
      return '<h1>Not found</h1><p>That page or product does not exist. <a href="#/">Go home</a>.</p>';
    }
  };

  TS.views = views;
})();
