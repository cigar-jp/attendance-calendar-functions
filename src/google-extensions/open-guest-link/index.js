chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'openInIncognito' && message.url) {
    // インコグニート（シークレット）ウィンドウで指定URLを開く
    chrome.windows.create({
      url: message.url,
      incognito: true,
    });
  }
});
