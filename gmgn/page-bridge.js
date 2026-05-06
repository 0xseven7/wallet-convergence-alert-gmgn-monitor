(() => {
  const PAGE_OPEN_EVENT = 'gmgn-monitor-open-url';
  const nativeOpen = window.open.bind(window);
  const nativeAnchorClick = HTMLAnchorElement.prototype.click;

  function normalizeUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl, window.location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }

      return parsed.href;
    } catch (_error) {
      return null;
    }
  }

  function isExternalToGmgn(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname !== 'gmgn.ai' && !parsed.hostname.endsWith('.gmgn.ai');
    } catch (_error) {
      return false;
    }
  }

  function dispatchExternalUrl(url, source) {
    window.dispatchEvent(
      new CustomEvent(PAGE_OPEN_EVENT, {
        detail: { url, source }
      })
    );
  }

  window.open = function patchedOpen(url, target, features) {
    const resolvedUrl = normalizeUrl(url);
    if (resolvedUrl && isExternalToGmgn(resolvedUrl)) {
      dispatchExternalUrl(resolvedUrl, 'window.open');
      return null;
    }

    return nativeOpen(url, target, features);
  };

  HTMLAnchorElement.prototype.click = function patchedAnchorClick() {
    const resolvedUrl = normalizeUrl(this.href || this.getAttribute('href'));
    if (resolvedUrl && isExternalToGmgn(resolvedUrl)) {
      dispatchExternalUrl(resolvedUrl, 'anchor.click');
      return;
    }

    return nativeAnchorClick.call(this);
  };
})();
