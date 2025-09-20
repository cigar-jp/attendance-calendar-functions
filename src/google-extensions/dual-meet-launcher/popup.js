document.getElementById('createMeet').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'createMeetAndCopyUrl' });
  // メッセージ送信後、すぐにポップアップを閉じるとユーザーが処理の開始を認識できない可能性があるため、
  // 少し遅延させるか、UIでフィードバックを返すことを検討してください。
  // window.close();
});

document.getElementById('openGuest').addEventListener('click', () => {
  navigator.clipboard
    .readText()
    .then((url) => {
      console.log('Clipboard content:', url); // デバッグ用ログ
      if (url && url.startsWith('http')) {
        // URL形式も簡易的にチェック
        chrome.runtime.sendMessage({ action: 'openInIncognito', url });
        window.close();
      } else {
        // クリップボードが空の場合の処理
        console.log('Clipboard is empty.');
        // 必要であればユーザーに通知
      }
    })
    .catch((err) => {
      console.error('Failed to read from clipboard: ', err);
    });
});
