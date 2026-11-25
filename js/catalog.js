/*
 * Product catalog + cart.
 * Product and variant `id`s are what integrations receive (e.g. Trialhood productId / variantId).
 * Add or edit products here; per-integration ID overrides can go in `externalIds`.
 */
(function () {
  'use strict';
  var TS = window.TestStore;

  var products = [
    {
      id: 'RA_7164U_6149',
      title: 'Classic Aviator Sunglasses',
      brand: 'Test Optics',
      category: 'eyewear',
      price: 169.0,
      description: 'Teardrop aviator with a thin metal frame. This is the product wired to the Trialhood test store by default.',
      tags: ['try-on', 'featured'],
      variants: [
        { id: 'RA_7164U_6149', name: 'Gold / Green', color: '#c9a227', lens: '#2f5d3a' }
      ]
    },
    {
      id: 'TS_EYE_ROUND_01',
      title: 'Round Metal Frames',
      brand: 'Test Optics',
      category: 'eyewear',
      price: 129.0,
      description: 'Round frame with keyhole bridge. Has several variants, so use it to test variant-change updates.',
      tags: ['try-on', 'variants'],
      variants: [
        { id: 'TS_EYE_ROUND_01_BLK', name: 'Black / Grey', color: '#222222', lens: '#555555' },
        { id: 'TS_EYE_ROUND_01_SLV', name: 'Silver / Blue', color: '#a7adb5', lens: '#2c4f7c' },
        { id: 'TS_EYE_ROUND_01_TRT', name: 'Tortoise / Brown', color: '#7a4a24', lens: '#5b3a22' }
      ]
    },
    {
      id: 'TS_EYE_WAY_02',
      title: 'Bold Square Frames',
      brand: 'Test Optics',
      category: 'eyewear',
      price: 149.0,
      description: 'Thick acetate square frame.',
      tags: ['try-on'],
      variants: [
        { id: 'TS_EYE_WAY_02_BLK', name: 'Matte Black', color: '#111111', lens: '#333333' },
        { id: 'TS_EYE_WAY_02_RED', name: 'Cherry', color: '#8b1e2d', lens: '#3a3a3a' }
      ]
    },
    {
      id: 'TS_APP_TEE_01',
      title: 'Everyday Cotton Tee',
      brand: 'Test Basics',
      category: 'apparel',
      price: 24.0,
      description: 'Plain crew-neck tee. Size and colour variants.',
      tags: ['variants'],
      variants: [
        { id: 'TS_APP_TEE_01_S_WHT', name: 'White / S', color: '#f2f2f2' },
        { id: 'TS_APP_TEE_01_M_WHT', name: 'White / M', color: '#f2f2f2' },
        { id: 'TS_APP_TEE_01_M_NVY', name: 'Navy / M', color: '#1f2d4d' },
        { id: 'TS_APP_TEE_01_L_NVY', name: 'Navy / L', color: '#1f2d4d' }
      ]
    },
    {
      id: 'TS_APP_HOOD_02',
      title: 'Fleece Hoodie',
      brand: 'Test Basics',
      category: 'apparel',
      price: 59.0,
      description: 'Heavyweight pullover hoodie.',
      tags: [],
      variants: [
        { id: 'TS_APP_HOOD_02_GRY', name: 'Heather Grey', color: '#9a9a9a' },
        { id: 'TS_APP_HOOD_02_OLV', name: 'Olive', color: '#5a6233' }
      ]
    },
    {
      id: 'TS_ACC_WATCH_01',
      title: 'Minimal Wrist Watch',
      brand: 'Test Time',
      category: 'accessories',
      price: 199.0,
      description: 'Three-hand watch with leather strap.',
      tags: ['featured'],
      variants: [
        { id: 'TS_ACC_WATCH_01_BRN', name: 'Brown strap', color: '#6b4226' },
        { id: 'TS_ACC_WATCH_01_BLK', name: 'Black strap', color: '#1a1a1a' }
      ]
    },
    {
      id: 'TS_ACC_BAG_02',
      title: 'Canvas Tote Bag',
      brand: 'Test Carry',
      category: 'accessories',
      price: 35.0,
      description: 'Single-variant product (no variant picker).',
      tags: [],
      variants: [{ id: 'TS_ACC_BAG_02', name: 'Natural', color: '#d8ccb0' }]
    },
    {
      id: 'TS_ACC_HAT_03',
      title: 'Wool Beanie',
      brand: 'Test Basics',
      category: 'accessories',
      price: 19.0,
      description: 'Ribbed knit beanie.',
      tags: [],
      variants: [
        { id: 'TS_ACC_HAT_03_RED', name: 'Red', color: '#b3261e' },
        { id: 'TS_ACC_HAT_03_CRM', name: 'Cream', color: '#efe6d2' }
      ]
    }
  ];

  // Extra products can be added at runtime from the tester panel (stored in localStorage).
  function allProducts() { return products.concat(TS.store.get('customProducts', [])); }
  function findProduct(id) { return allProducts().find(function (p) { return p.id === id; }) || null; }
  function findVariant(product, variantId) {
    if (!product) return null;
    return product.variants.find(function (v) { return v.id === variantId; }) || product.variants[0];
  }

  // Simple generated product art so the site needs no image hosting.
  function art(product, variant) {
    var v = variant || product.variants[0];
    var c = v.color || '#888';
    var lens = v.lens || '#444';
    var bg = '#f4f1ec';
    var shape;
    if (product.category === 'eyewear') {
      shape =
        '<g fill="' + lens + '" fill-opacity=".75" stroke="' + c + '" stroke-width="6">' +
        '<ellipse cx="135" cy="150" rx="62" ry="48"/><ellipse cx="265" cy="150" rx="62" ry="48"/></g>' +
        '<path d="M197 140 q3 -14 6 0" stroke="' + c + '" stroke-width="6" fill="none"/>' +
        '<path d="M73 135 L30 120 M327 135 L370 120" stroke="' + c + '" stroke-width="6"/>';
    } else if (product.category === 'apparel') {
      shape = '<path d="M140 80 L110 95 L70 140 L100 165 L120 145 L120 250 L280 250 L280 145 L300 165 L330 140 L290 95 L260 80 Q200 115 140 80Z" fill="' + c + '" stroke="#0002" stroke-width="3"/>';
    } else {
      shape = '<circle cx="200" cy="150" r="80" fill="' + c + '"/><circle cx="200" cy="150" r="58" fill="#fff" fill-opacity=".85"/>' +
        '<path d="M200 150 L200 110 M200 150 L230 165" stroke="#222" stroke-width="5" stroke-linecap="round"/>';
    }
    return '<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      TS.esc(product.title + ' — ' + v.name) + '"><rect width="400" height="300" fill="' + bg + '"/>' + shape + '</svg>';
  }

  // ---------- cart ----------
  var cart = {
    items: function () { return TS.store.get('cart', []); },
    save: function (items) {
      TS.store.set('cart', items);
      TS.emit('cart-changed', items);
      TS.callHook('cartChange', { cart: items });
    },
    add: function (product, variant, qty) {
      var items = cart.items();
      var existing = items.find(function (i) { return i.variantId === variant.id; });
      if (existing) existing.qty += qty;
      else items.push({ productId: product.id, variantId: variant.id, title: product.title, variantName: variant.name, price: variant.price || product.price, qty: qty });
      cart.save(items);
      TS.callHook('addToCart', { product: product, variant: variant, qty: qty });
    },
    setQty: function (variantId, qty) {
      var items = cart.items().map(function (i) { if (i.variantId === variantId) i.qty = qty; return i; })
        .filter(function (i) { return i.qty > 0; });
      cart.save(items);
    },
    clear: function () { cart.save([]); },
    count: function () { return cart.items().reduce(function (n, i) { return n + i.qty; }, 0); },
    total: function () { return cart.items().reduce(function (n, i) { return n + i.qty * i.price; }, 0); }
  };

  TS.catalog = { products: allProducts, find: findProduct, findVariant: findVariant, art: art };
  TS.cart = cart;
})();
