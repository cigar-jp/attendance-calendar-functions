chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in background:', message); // デバッグ用ログ
  if (message.action === 'openInIncognito' && message.url) {
    console.log('Opening in incognito:', message.url); // デバッグ用ログ
    chrome.windows.create({
      url: message.url,
      incognito: true,
    });
  } else if (message.action === 'createMeetAndCopyUrl') {
    chrome.tabs.create(
      { url: 'https://meet.google.com/new', active: true },
      (newTab) => {
        // タブが完全に読み込まれるのを待つためのリスナー
        const listener = (tabId, changeInfo, tab) => {
          if (
            tabId === newTab.id &&
            changeInfo.status === 'complete' &&
            tab.url &&
            tab.url.startsWith('https://meet.google.com/')
          ) {
            // meet.google.com/new からリダイレクトされた実際のMeet URLであることを確認
            if (tab.url !== 'https://meet.google.com/new') {
              chrome.scripting.executeScript(
                {
                  target: { tabId: tabId },
                  func: copyToClipboard,
                  args: [tab.url],
                },
                () => {
                  if (chrome.runtime.lastError) {
                    console.error(
                      'Failed to copy Meet URL:',
                      chrome.runtime.lastError.message
                    );
                  } else {
                    console.log('Meet URL copied to clipboard:', tab.url);
                  }
                  // 必要であればここでタブを閉じる chrome.tabs.remove(tabId);
                }
              );
              // リスナーを削除
              chrome.tabs.onUpdated.removeListener(listener);
            }
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      }
    );
    return true; // 非同期処理を示すためにtrueを返す
  }
});

// この関数はコンテンツスクリプトとしてタブ内で実行されます
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      // 成功時の処理はbackground側で行うため、ここでは何もしない
    })
    .catch((err) => {
      console.error('Content script: Failed to copy text: ', err);
    });
}
