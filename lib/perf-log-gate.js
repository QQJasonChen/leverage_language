// Production log gate: disables verbose console output in non-Dev builds
(function gateConsoleLogsForProduction() {
  try {
    const manifest = (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getManifest === 'function')
      ? chrome.runtime.getManifest()
      : {};
    const name = manifest && manifest.name ? manifest.name : '';
    const isProduction = !name || !name.toLowerCase().includes('dev');

    if (isProduction && typeof console !== 'undefined') {
      const noop = function () {};
      // Keep console.error for critical issues, silence noisy logs in production
      console.log = noop;
      console.info = noop;
      console.debug = noop;
      console.warn = noop;
    }
  } catch (e) {
    // Fail-safe: never break the page due to logging gate
  }
})();

