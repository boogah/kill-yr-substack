/**
 * Kill Yr Substack - Background Service Worker
 *
 * Three redirect paths:
 * 1. Known Substack URLs — static declarativeNetRequest (rules.json), loads instantly
 *    - *.substack.com/p/* (posts)
 *    - substack.com/@* (profiles)
 * 2. Cached custom domains — dynamic declarativeNetRequest, page never loads (after first detection)
 * 3. Unknown custom domains — content script sniffs DOM, redirects, then caches domain for next time
 */

const ARCHIVE_BASE = 'https://archive.is/?run=1&url=';
const STATIC_RULESET_ID = 'substack_rules';
const DYNAMIC_ID_START = 1000;

// --- rule builders ---

function buildDomainRule(id, hostname) {
  var escaped = hostname.replace(/\./g, '\\.');
  return {
    id: id,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { regexSubstitution: ARCHIVE_BASE + '\\0' }
    },
    condition: {
      regexFilter: '^https?://' + escaped + '/.*',
      resourceTypes: ['main_frame']
    }
  };
}

// --- rule management ---

async function getAllRuleIds() {
  var rules = await chrome.declarativeNetRequest.getDynamicRules();
  return rules.map(r => r.id);
}

async function rebuildRules() {
  var { enabled, cachedDomains } = await chrome.storage.local.get({
    enabled: true,
    cachedDomains: []
  });

  // Toggle static ruleset
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enabled ? [STATIC_RULESET_ID] : [],
    disableRulesetIds: enabled ? [] : [STATIC_RULESET_ID]
  });

  // Clear existing dynamic rules
  var existing = await getAllRuleIds();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing
  });

  if (!enabled) return;

  // Add dynamic rules for cached custom domains
  var rules = [];
  cachedDomains.forEach(function (hostname, i) {
    rules.push(buildDomainRule(DYNAMIC_ID_START + i, hostname));
  });

  if (rules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules
    });
  }
}

// --- domain cache ---

async function cacheDomain(hostname) {
  var { cachedDomains } = await chrome.storage.local.get({ cachedDomains: [] });
  if (cachedDomains.includes(hostname)) return;
  cachedDomains.push(hostname);
  await chrome.storage.local.set({ cachedDomains: cachedDomains });
  await rebuildRules();
}

async function removeDomain(hostname) {
  var { cachedDomains } = await chrome.storage.local.get({ cachedDomains: [] });
  cachedDomains = cachedDomains.filter(function (d) { return d !== hostname; });
  await chrome.storage.local.set({ cachedDomains: cachedDomains });
  await rebuildRules();
}

async function clearDomains() {
  await chrome.storage.local.set({ cachedDomains: [] });
  await rebuildRules();
}

// --- lifecycle ---

chrome.runtime.onInstalled.addListener(async () => {
  var { enabled } = await chrome.storage.local.get({ enabled: true });
  await chrome.storage.local.set({ enabled: enabled });
  await rebuildRules();
});

chrome.runtime.onStartup.addListener(() => rebuildRules());

// Ensure rules are ready immediately on script load (Firefox fix)
rebuildRules();

// --- messaging ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {

    case 'getState':
      chrome.storage.local.get({ enabled: true, cachedDomains: [] }).then(sendResponse);
      return true;

    case 'toggle':
      (async () => {
        var { enabled } = await chrome.storage.local.get({ enabled: true });
        var next = !enabled;
        await chrome.storage.local.set({ enabled: next });
        await rebuildRules();
        var data = await chrome.storage.local.get({ cachedDomains: [] });
        sendResponse({ enabled: next, cachedDomains: data.cachedDomains });
      })();
      return true;

    case 'redirect':
      if (sender.tab?.id && msg.url) {
        chrome.tabs.update(sender.tab.id, {
          url: ARCHIVE_BASE + encodeURIComponent(msg.url)
        });
        if (msg.hostname) {
          cacheDomain(msg.hostname);
        }
      }
      break;

    case 'removeDomain':
      removeDomain(msg.hostname).then(() => {
        chrome.storage.local.get({ enabled: true, cachedDomains: [] }).then(sendResponse);
      });
      return true;

    case 'clearDomains':
      clearDomains().then(() => {
        sendResponse({ cachedDomains: [] });
      });
      return true;
  }
});
