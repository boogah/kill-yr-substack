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

const ARCHIVE_SERVICES = {
  'archive.is': {
    url: 'https://archive.is/?run=1&url=',
    ruleset: 'substack_rules'
  },
  'ghostarchive': {
    url: 'https://ghostarchive.org/search?term=',
    ruleset: 'substack_rules_ghostarchive'
  }
};
const DYNAMIC_ID_START = 1000;

// Lock to prevent concurrent rebuildRules() calls
var rebuildInProgress = false;
var rebuildPending = false;

// --- rule builders ---

function buildDomainRule(id, hostname, archiveService) {
  var service = ARCHIVE_SERVICES[archiveService] || ARCHIVE_SERVICES['archive.is'];
  var escaped = hostname.replace(/\./g, '\\.');
  return {
    id: id,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { regexSubstitution: service.url + '\\0' }
    },
    condition: {
      regexFilter: '^https?://' + escaped + '(/.*)?$',
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
  // If rebuild already in progress, mark pending and return
  if (rebuildInProgress) {
    rebuildPending = true;
    return;
  }

  rebuildInProgress = true;

  try {
    var { enabled, cachedDomains } = await chrome.storage.local.get({
      enabled: true,
      cachedDomains: []
    });
    var { archiveService } = await chrome.storage.sync.get({ archiveService: 'archive.is' });
    var service = ARCHIVE_SERVICES[archiveService] || ARCHIVE_SERVICES['archive.is'];

    // Toggle static rulesets (enable one, disable the other)
    var allRulesets = Object.keys(ARCHIVE_SERVICES).map(function (k) { return ARCHIVE_SERVICES[k].ruleset; });
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enabled ? [service.ruleset] : [],
      disableRulesetIds: enabled ? allRulesets.filter(function (r) { return r !== service.ruleset; }) : allRulesets
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
      rules.push(buildDomainRule(DYNAMIC_ID_START + i, hostname, archiveService));
    });

    if (rules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules
      });
    }
  } catch (err) {
    console.error('Kill Yr Substack: Failed to rebuild rules:', err);
  } finally {
    rebuildInProgress = false;

    // If another rebuild was requested while we were busy, run it now
    if (rebuildPending) {
      rebuildPending = false;
      rebuildRules();
    }
  }
}

// --- domain cache ---

async function cacheDomain(hostname) {
  try {
    var { cachedDomains } = await chrome.storage.local.get({ cachedDomains: [] });
    if (cachedDomains.includes(hostname)) return;
    cachedDomains.push(hostname);
    await chrome.storage.local.set({ cachedDomains: cachedDomains });
    await rebuildRules();
  } catch (err) {
    console.error('Kill Yr Substack: Failed to cache domain:', err);
  }
}

async function removeDomain(hostname) {
  try {
    var { cachedDomains } = await chrome.storage.local.get({ cachedDomains: [] });
    cachedDomains = cachedDomains.filter(function (d) { return d !== hostname; });
    await chrome.storage.local.set({ cachedDomains: cachedDomains });
    await rebuildRules();
  } catch (err) {
    console.error('Kill Yr Substack: Failed to remove domain:', err);
  }
}

async function clearDomains() {
  try {
    await chrome.storage.local.set({ cachedDomains: [] });
    await rebuildRules();
  } catch (err) {
    console.error('Kill Yr Substack: Failed to clear domains:', err);
  }
}

// --- lifecycle ---

chrome.runtime.onInstalled.addListener(async () => {
  try {
    var { enabled } = await chrome.storage.local.get({ enabled: true });
    await chrome.storage.local.set({ enabled: enabled });
    await rebuildRules();
  } catch (err) {
    console.error('Kill Yr Substack: Failed on install:', err);
  }
});

chrome.runtime.onStartup.addListener(() => {
  rebuildRules().catch(function (err) {
    console.error('Kill Yr Substack: Failed on startup:', err);
  });
});

// Ensure rules are ready immediately on script load (Firefox fix)
rebuildRules().catch(function (err) {
  console.error('Kill Yr Substack: Failed on script load:', err);
});

// Listen for archive service preference changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.archiveService) {
    rebuildRules();
  }
});

// --- messaging ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {

    case 'getState':
      chrome.storage.local.get({ enabled: true, cachedDomains: [] }).then(sendResponse);
      return true;

    case 'toggle':
      (async () => {
        try {
          var { enabled } = await chrome.storage.local.get({ enabled: true });
          var next = !enabled;
          await chrome.storage.local.set({ enabled: next });
          await rebuildRules();
          var data = await chrome.storage.local.get({ cachedDomains: [] });
          sendResponse({ enabled: next, cachedDomains: data.cachedDomains });
        } catch (err) {
          console.error('Kill Yr Substack: Failed to toggle:', err);
          sendResponse({ enabled: false, cachedDomains: [] });
        }
      })();
      return true;

    case 'redirect':
      if (sender.tab?.id && msg.url) {
        (async () => {
          try {
            var { archiveService } = await chrome.storage.sync.get({ archiveService: 'archive.is' });
            var service = ARCHIVE_SERVICES[archiveService] || ARCHIVE_SERVICES['archive.is'];
            chrome.tabs.update(sender.tab.id, {
              url: service.url + msg.url
            });
            if (msg.hostname) {
              cacheDomain(msg.hostname);
            }
          } catch (err) {
            console.error('Kill Yr Substack: Failed to redirect:', err);
          }
        })();
      }
      break;

    case 'removeDomain':
      removeDomain(msg.hostname).then(() => {
        chrome.storage.local.get({ enabled: true, cachedDomains: [] }).then(sendResponse);
      }).catch(function (err) {
        console.error('Kill Yr Substack: Failed to remove domain:', err);
        sendResponse({ enabled: true, cachedDomains: [] });
      });
      return true;

    case 'clearDomains':
      clearDomains().then(() => {
        sendResponse({ cachedDomains: [] });
      }).catch(function (err) {
        console.error('Kill Yr Substack: Failed to clear domains:', err);
        sendResponse({ cachedDomains: [] });
      });
      return true;
  }
});
