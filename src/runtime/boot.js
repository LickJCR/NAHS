  function boot(attempt = 0) {
    if (isLikelyNewApiPage()) {
      mount();
      return;
    }
    if (attempt < 20) {
      window.setTimeout(() => boot(attempt + 1), 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
  } else {
    boot();
  }
