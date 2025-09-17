// options.js
// Handles saving and restoring user preferences for contest platforms

document.addEventListener('DOMContentLoaded', function () {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  const saveButton = document.getElementById('save');
  const usernameInput = document.getElementById('clist-username');
  const apikeyInput = document.getElementById('clist-apikey');

  // Restore saved options
  chrome.storage.sync.get(['selectedPlatforms', 'clistUsername', 'clistApiKey'], function (data) {
    if (data.selectedPlatforms) {
      checkboxes.forEach(cb => {
        cb.checked = data.selectedPlatforms.includes(cb.value);
      });
    }
    if (data.clistUsername) {
      usernameInput.value = data.clistUsername;
    }
    if (data.clistApiKey) {
      apikeyInput.value = data.clistApiKey;
    }
  });

  // Save options
  saveButton.addEventListener('click', function () {
    const selected = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    const username = usernameInput.value.trim();
    const apikey = apikeyInput.value.trim();
    chrome.storage.sync.set({
      selectedPlatforms: selected,
      clistUsername: username,
      clistApiKey: apikey
    }, function () {
      saveButton.textContent = 'Saved!';
      setTimeout(() => { saveButton.textContent = 'Save'; }, 1000);
    });
  });

  // Responsive: update Save button state on change
  checkboxes.forEach(cb => {
    cb.addEventListener('change', function () {
      saveButton.textContent = 'Save';
    });
  });
  usernameInput.addEventListener('input', function () {
    saveButton.textContent = 'Save';
  });
  apikeyInput.addEventListener('input', function () {
    saveButton.textContent = 'Save';
  });
});
