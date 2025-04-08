// 拡張機能のアイコンがクリックされたときの処理
chrome.action.onClicked.addListener(() => {
  // インコグニート（シークレット）ウィンドウで指定URLを開く
  chrome.windows.create({
    url: 'https://meetings.hubspot.com/treatment/coupletreatmentmedel?uuid=47be5bff-5f1d-4aed-b026-fd27eafb185b',
    incognito: true,
  });
});
