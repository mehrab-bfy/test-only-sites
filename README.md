# Test Store — universal integration tester

A neutral, test-only storefront for checking third-party storefront scripts (Trialhood, Messavo, and whatever comes next): try-on viewers, widgets, analytics, checkout add-ons.

Plain HTML/CSS/JS. No build step, no dependencies. Runs on GitHub Pages or any static server.

## Run locally

```powershell
python -m http.server 5173
```

Open http://localhost:5173. (Opening `index.html` directly from disk also mostly works, but some vendor SDKs refuse `file://` origins.)

## What's in it

| Page | Route | Notes |
|---|---|---|
| Home | `#/` | All products |
| Category | `#/category/eyewear` | `eyewear`, `apparel`, `accessories` |
| Product | `#/product/<productId>?variant=<variantId>` | Variant picker, add to cart, integration slots |
| Cart | `#/cart` | |
| Checkout | `#/checkout` | Fake form, fires the `purchase` hook |
| Thank you | `#/thank-you` | |
| Snippet pages | `static/index.html` | Plain pages with vendor snippets pasted verbatim (no router), one per snippet |

Trialhood products: `RA_7164U_6149` (store `st_98e038ef8da584a264adc0be`, the default) and `VC_S19146_C1 XW` (store `st_3366dc906e92b70c11930a8a`). A product can point at its own Trialhood store with `trialhood: { storeId }` in `js/catalog.js`.

## Tester panel

Click **Tester** (bottom right), or add `?panel=1` to the URL.

- **Integrations** — turn each vendor on/off and edit its settings (SDK URL, store ID, product/variant overrides) as JSON. Saved in the browser; reload to apply.
- **Scripts** — paste any script URL or inline JS without touching the code. Run it once on load, or on every SPA page change, limited to some pages if you like.
- **Context** — exactly what integrations see now: page, product ID, variant ID, consent, cart.
- **Log** — every hook call, script load, `vendor:*` window event, uncaught error and promise rejection.
- **Settings** — switch between **SPA** navigation (mount / update / destroy without reloads) and **Full reload** navigation (classic multi-page site); add a test product with your own IDs; reset everything.

### URL switches

| Param | Effect |
|---|---|
| `?panel=1` | Open the tester panel |
| `?enable=messavo,trialhood` | Turn integrations on (saved) |
| `?disable=trialhood` | Turn integrations off (saved) |
| `?consent=hide` | Don't show the cookie banner (for clean screenshots) |
| `?reset=1` | Clear all saved test state |

## Trialhood

[integrations/trialhood.js](integrations/trialhood.js) follows Trialhood's SPA pattern:

| Store event | Trialhood call |
|---|---|
| Product page opens | `Trialhood.mount({ target, storeId, productId, variantId, consent })` |
| Variant picked | `instance.update({ variantId })` |
| Cookie banner changes | `instance.setConsent({ analytics })` |
| Leave product page | `instance.destroy()` |

It waits for `window.Trialhood` or the `trialhood:ready` event before mounting.

**SDK URL:** defaults to `https://cdn.trialhood.com/sdk/v1/loader.js`. Change it under Tester → Integrations → Trialhood → Settings → `sdkUrl`.

**Allowed domains:** Trialhood's API only answers approved origins. On a domain that isn't approved (e.g. `localhost`) the SDK loads but its API calls fail CORS and the viewer stays hidden. Ask Trialhood to allow the deployed domain for the store.

**No real SDK yet?** Set `sdkUrl` to `mocks/trialhood-mock.js`. It's a fake with the same API that draws a box showing the IDs it received, so you can check the wiring. The static page always uses the real SDK (snippet pasted verbatim).

## Adding a new script / vendor

Two ways:

**Quick (no code):** Tester → Scripts → paste the snippet → Save & run.

**Permanent (in the repo):**

1. Copy [integrations/_template.js](integrations/_template.js) to `integrations/<vendor>.js`.
2. Fill in `settings`, `scripts`, `slots` and the hooks you need.
3. Add `'<vendor>.js'` to [integrations/manifest.js](integrations/manifest.js).

### Hooks

Each hook gets a `ctx` with `page`, `params`, `product`, `variant`, `settings`, `consent`, `cart`, `log()` and `loadScript()`. Hooks can be async; errors are caught and logged so one broken vendor can't break the page.

| Hook | When |
|---|---|
| `init` | Once, after the vendor's scripts load |
| `pageEnter` | After each page renders (including the first) |
| `pageLeave` | Before the next page renders — clean up here |
| `variantChange` | Variant picked on a product page (no re-render) |
| `consentChange` | Cookie banner saved |
| `addToCart` | `ctx.product`, `ctx.variant`, `ctx.qty` |
| `cartChange` | `ctx.cart` |
| `purchase` | `ctx.order` on checkout |

### Slots

Integrations inject markup into named slots:

`global-top`, `global-bottom`, `home-top`, `home-bottom`, `category-top`, `category-bottom`, `product-top`, `product-media-after`, `product-info-before-cart`, `product-info-after`, `product-bottom`, `cart-bottom`, `checkout-top`, `checkout-bottom`, `thankyou-bottom`.

## Files

```
index.html               store shell
static/                  snippet pages: non-SPA product pages, vendor snippet verbatim
css/styles.css
js/core.js               storage, log, script loader, integration registry + hooks
js/catalog.js            products + cart (edit products here)
js/views.js              page templates + slots
js/consent.js            cookie banner → consentChange
js/devpanel.js           tester panel + ad-hoc scripts
js/app.js                router + boot order
integrations/manifest.js list of integration files
integrations/*.js        one file per vendor (_template.js to start a new one)
mocks/                   fake SDKs for wiring checks
```

## Console helpers

```js
TestStore.navigate('#/product/RA_7164U_6149')
TestStore.selectVariant('TS_EYE_ROUND_01_SLV')
TestStore.consent.set({ analytics: true, marketing: false })
TestStore.trialhood()          // the mounted Trialhood instance
TestStore.logEntries()
```
