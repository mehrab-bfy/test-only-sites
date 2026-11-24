/*
 * The list of integration files to load. To add a new vendor/script:
 *   1. Copy integrations/_template.js to integrations/<vendor>.js and fill it in.
 *   2. Add '<vendor>.js' to this list.
 * Files load in order, before the store boots.
 */
window.TestStore.integrationFiles = [
  'trialhood.js',
  'messavo.js'
  // 'my-new-vendor.js',
];

window.TestStore.integrationsLoaded = window.TestStore.integrationFiles.reduce(function (p, file) {
  return p.then(function () {
    return window.TestStore.loadScript('integrations/' + file).catch(function () { /* logged by loader */ });
  });
}, Promise.resolve());
