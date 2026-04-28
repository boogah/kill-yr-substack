(function () {
  'use strict';

  var archiveIsRadio = document.getElementById('archive-is');
  var ghostarchiveRadio = document.getElementById('ghostarchive');
  var saveBtn = document.getElementById('save');
  var savedMsg = document.getElementById('saved');

  // Load saved preference
  chrome.storage.sync.get({ archiveService: 'archive.is' }, function (data) {
    if (data.archiveService === 'ghostarchive') {
      ghostarchiveRadio.checked = true;
    } else {
      archiveIsRadio.checked = true;
    }
  });

  // Save preference
  saveBtn.addEventListener('click', function () {
    var selected = archiveIsRadio.checked ? 'archive.is' : 'ghostarchive';

    chrome.storage.sync.set({ archiveService: selected }, function () {
      savedMsg.classList.add('show');
      setTimeout(function () {
        savedMsg.classList.remove('show');
      }, 2000);
    });
  });
})();
