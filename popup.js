var toggle = document.getElementById('toggle');
var status = document.getElementById('status');
var section = document.getElementById('domains-section');
var list = document.getElementById('domain-list');
var clearBtn = document.getElementById('clear-all');

function updateUI(state) {
  toggle.checked = state.enabled;
  status.textContent = state.enabled ? 'Redirecting Substack' : 'Paused';
  status.className = 'status' + (state.enabled ? ' on' : '');
  renderDomains(state.cachedDomains || []);
}

function renderDomains(domains) {
  list.innerHTML = '';

  if (domains.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;

  domains.sort().forEach(function (domain) {
    var li = document.createElement('li');

    var span = document.createElement('span');
    span.textContent = domain;
    li.appendChild(span);

    var btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '\u00d7';
    btn.title = 'Remove ' + domain;
    btn.addEventListener('click', function () {
      chrome.runtime.sendMessage({ type: 'removeDomain', hostname: domain }, updateUI);
    });
    li.appendChild(btn);

    list.appendChild(li);
  });
}

// load state
chrome.runtime.sendMessage({ type: 'getState' }, updateUI);

// toggle
toggle.addEventListener('change', function () {
  chrome.runtime.sendMessage({ type: 'toggle' }, updateUI);
});

// clear all
clearBtn.addEventListener('click', function () {
  chrome.runtime.sendMessage({ type: 'clearDomains' }, function (res) {
    updateUI({ enabled: toggle.checked, cachedDomains: [] });
  });
});
