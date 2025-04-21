chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'openInIncognito') {
    // インコグニート（シークレット）ウィンドウで指定URLを開く
    chrome.windows.create({
      url: 'https://meetings.hubspot.com/treatment/coupletreatmentmedel?uuid=47be5bff-5f1d-4aed-b026-fd27eafb185b',
      incognito: true,
    });
  }
});
