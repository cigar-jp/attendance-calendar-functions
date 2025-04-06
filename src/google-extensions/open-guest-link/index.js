// 拡張機能のアイコンがクリックされたときの処理
chrome.action.onClicked.addListener(() => {
  // インコグニート（シークレット）ウィンドウで指定URLを開く
  chrome.windows.create({
    url: 'https://meetings.hubspot.com/treatment/120min',
    incognito: true,
  });
});
