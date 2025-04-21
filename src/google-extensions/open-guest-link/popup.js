document.getElementById('openLink').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'openInIncognito' });
  window.close();
});
