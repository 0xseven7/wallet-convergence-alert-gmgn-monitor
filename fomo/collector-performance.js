(() => {
  'use strict';

  const MODE_EVENT = 'wallet-convergence:fomo-collector-mode';
  const FRAME_INTERVAL_MS = 500;
  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);

  if (window.__walletConvergenceFomoCollectorPerformanceInstalled) return;
  window.__walletConvergenceFomoCollectorPerformanceInstalled = true;

  const callbacks = new Map();
  let nextHandle = 1;
  let scheduledFrame = 0;
  let scheduledTimer = 0;
  let nextCollectorFrameAt = 0;

  function collectorModeActive() {
    return document.documentElement?.dataset?.gcpFomoCollectorMode === '1';
  }

  function clearScheduledWakeup() {
    if (scheduledFrame) nativeCancelAnimationFrame(scheduledFrame);
    if (scheduledTimer) nativeClearTimeout(scheduledTimer);
    scheduledFrame = 0;
    scheduledTimer = 0;
  }

  function flushCallbacks(timestamp) {
    scheduledFrame = 0;
    const pending = Array.from(callbacks.entries());
    callbacks.clear();
    if (collectorModeActive()) {
      nextCollectorFrameAt = Number(timestamp || performance.now()) + FRAME_INTERVAL_MS;
    } else {
      nextCollectorFrameAt = 0;
    }
    for (const [, callback] of pending) {
      try {
        callback(timestamp);
      } catch (error) {
        nativeSetTimeout(() => {
          throw error;
        }, 0);
      }
    }
    scheduleWakeup();
  }

  function scheduleWakeup() {
    if (!callbacks.size || scheduledFrame || scheduledTimer) return;
    if (!collectorModeActive()) {
      scheduledFrame = nativeRequestAnimationFrame(flushCallbacks);
      return;
    }
    const delay = Math.max(0, nextCollectorFrameAt - performance.now());
    scheduledTimer = nativeSetTimeout(() => {
      scheduledTimer = 0;
      scheduledFrame = nativeRequestAnimationFrame(flushCallbacks);
    }, delay);
  }

  window.requestAnimationFrame = function requestAnimationFrame(callback) {
    if (typeof callback !== 'function') {
      return nativeRequestAnimationFrame(callback);
    }
    const handle = -(nextHandle++);
    callbacks.set(handle, callback);
    scheduleWakeup();
    return handle;
  };

  window.cancelAnimationFrame = function cancelAnimationFrame(handle) {
    if (callbacks.delete(handle)) return;
    nativeCancelAnimationFrame(handle);
  };

  window.addEventListener(MODE_EVENT, () => {
    clearScheduledWakeup();
    if (!collectorModeActive()) nextCollectorFrameAt = 0;
    scheduleWakeup();
  });
})();
