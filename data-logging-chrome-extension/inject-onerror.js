// inject-onerror.js — runs in page world to capture window.onerror
(function(){
  const prev = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    window.postMessage({
      __codeMetricsError: true,
      message: String(message),
      stack: error && error.stack ? String(error.stack) : null
    }, '*');
    if (typeof prev === 'function') {
      return prev.apply(this, arguments);
    }
    return false;
  };
})();