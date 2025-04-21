document.querySelectorAll('.links button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const url = btn.getAttribute('data-url');
    chrome.runtime.sendMessage({ action: 'openInIncognito', url });
    window.close();
  });
});
