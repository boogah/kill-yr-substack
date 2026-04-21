/**
 * Kill Yr Substack - Content Script
 *
 * Detects Substack sites running on custom domains by checking for
 * platform fingerprints in the DOM. Only fires on non-substack.com
 * pages (the manifest excludes known substack.com and archive.* domains).
 *
 * Sniffs are ordered from most to least definitive.
 */

(function () {
  'use strict';

  // bail if this isn't an article-shaped URL (skip homepages, asset paths, etc.)
  var path = window.location.pathname;
  if (path === '/' || /\.(js|css|png|jpg|svg|woff2?|json|xml)$/i.test(path)) return;

  chrome.storage.local.get({ enabled: true }, function (data) {
    if (!data.enabled) return;

    if (isSubstack()) {
      chrome.runtime.sendMessage({
        type: 'redirect',
        url: window.location.href,
        hostname: window.location.hostname
      });
    }
  });

  function isSubstack() {
    // 1. generator meta tag (most definitive)
    if (document.querySelector('meta[name="generator"][content="Substack"]')) return true;

    // 2. substackcdn assets (stylesheets, preloads, fonts)
    if (document.querySelector('link[href*="substackcdn.com"]')) return true;

    // 3. substack scripts (app bundles, analytics)
    if (document.querySelector(
      'script[src*="substack.com"], script[src*="substackcdn.com"]'
    )) return true;

    // 4. substack react app shell
    if (document.querySelector('[data-component-name="AppFrame"]')) return true;

    // 5. rss feed pointing back to substack.com
    var rss = document.querySelector('link[type="application/rss+xml"]');
    if (rss && /substack\.com/.test(rss.getAttribute('href'))) return true;

    // 6. substack-specific class on the post body
    if (document.querySelector('.available-content, .post-content')) {
      // only flag if there's also a substack signup form nearby
      if (document.querySelector(
        'form[action*="substack.com"], .subscribe-widget, [class*="subscribe-btn"]'
      )) return true;
    }

    return false;
  }
})();
