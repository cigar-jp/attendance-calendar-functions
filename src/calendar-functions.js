/**
 * 指定されたスプレッドシートからデータを取得し、Google カレンダーに終日イベントとして登録する
 * ※A列がプロパティで指定された名前の行のみ処理します。
 */
function addEventsFromSpreadsheet() {
  // プロジェクトのスクリプト プロパティから定数を取得
  const scriptProperties = PropertiesService.getScriptProperties();
  const targetName = scriptProperties.getProperty('TARGET_NAME'); // フィルタ対象の名前
  const calendarId = scriptProperties.getProperty('CALENDAR_ID'); // カレンダーID
  const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID'); // スプレッドシートID

  if (!targetName || !calendarId || !spreadsheetId) {
    Logger.log(
      'プロジェクトのプロパティに TARGET_NAME または CALENDAR_ID または SPREADSHEET_ID が設定されていません。',
    );
    return;
  }

  // スプレッドシートをIDで取得
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName('Sheet1'); // シート名を必要に応じて変更してください
  if (!sheet) {
    Logger.log('指定のシートが見つかりません。');
    return;
  }

  // シート全体のデータを取得（ヘッダー行を除く）
  const data = sheet.getDataRange().getValues();
  Logger.log('全行数: ' + data.length);

  // ヘッダー行を除いたデータをフィルタリング（A列がプロパティで指定された名前の行のみ）
  const filteredData = data.filter((row, index) => {
    // ヘッダー行はスキップ
    if (index === 0) return false;
    return String(row[0]).trim() === targetName;
  });

  Logger.log('フィルタ後の行数: ' + filteredData.length);

  // カレンダーを取得
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    Logger.log('指定のカレンダーが見つかりません: ' + calendarId);
    return;
  }

  // フィルタ済みデータを処理
  filteredData.forEach((row, index) => {
    Logger.log('=== フィルタ後の行番号: ' + index + ' ===');

    // C列：年月日 が空の場合はスキップ
    const dateStr = row[2];
    if (!dateStr) {
      Logger.log('行 ' + (index + 1) + '：日付が空のためスキップ');
      return;
    }
    Logger.log('行 ' + (index + 1) + '：日付 = ' + dateStr);

    // 日付文字列から Date オブジェクトに変換（※タイムゾーンに注意）
    const eventDate = new Date(dateStr);

    // D列：スケジュール雛形ID を取得（文字列に変換してチェック）
    const scheduleTemplateId = String(row[3]).trim();

    // E列：出勤予定時刻、F列：退勤予定時刻を取得
    const startTimeStr = row[4];
    const endTimeStr = row[5];

    if (!startTimeStr || !endTimeStr) {
      Logger.log(
        '行 ' +
          (index + 1) +
          '：出勤予定時刻または退勤予定時刻が空のためスキップ',
      );
      return;
    }

    let title = '';

    if (scheduleTemplateId === '0') {
      // スケジュール雛形IDが0の場合は「公休」を設定（強い条件）
      title = '公休';
      Logger.log(
        '行 ' + (index + 1) + '：スケジュール雛形IDが0のためタイトルは「公休」',
      );
    } else {
      // スケジュール雛形IDが "0" 以外の場合はスケジュールを処理
      const startDecimal = convertTimeStringToDecimal(startTimeStr);
      const endDecimal = convertTimeStringToDecimal(endTimeStr);
      title = startDecimal + '-' + endDecimal;
      Logger.log(
        '行 ' +
          (index + 1) +
          '：出勤 ' +
          startTimeStr +
          ' → ' +
          startDecimal +
          ', 退勤 ' +
          endTimeStr +
          ' → ' +
          endDecimal +
          ' によりタイトル作成: ' +
          title,
      );
    }

    // 同タイトルの終日イベントがすでに存在するか確認
    const existingEvents = calendar
      .getEventsForDay(eventDate)
      .filter((event) => event.isAllDayEvent() && event.getTitle() === title);
    if (existingEvents.length > 0) {
      Logger.log(
        '行 ' +
          (index + 1) +
          '：同じタイトルの終日イベントが既に存在するためスキップ',
      );
      return;
    }

    // 終日イベントとしてカレンダーにイベントを作成
    calendar.createAllDayEvent(title, eventDate);
    Logger.log(
      '行 ' +
        (index + 1) +
        '：カレンダーにイベントを作成しました。日付: ' +
        eventDate.toDateString() +
        ' / タイトル: ' +
        title,
    );
  });
}

/**
 * 時刻文字列を小数表記の文字列に変換する関数
 * 例: "9:00" → "9", "20:30" → "20.5"
 *
 * @param {string} timeStr - "HH:mm" 形式の文字列
 * @return {string} 小数表記の時刻文字列
 */
function convertTimeStringToDecimal(timeStr) {
  const parts = timeStr.split(':');
  if (parts.length !== 2) return timeStr;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  // 分が 0 の場合は整数、30の場合は ".5" を付ける。その他の場合は小数計算
  if (minutes === 0) {
    return hours.toString();
  } else if (minutes === 30) {
    return hours + '.5';
  } else {
    return (hours + minutes / 60).toFixed(2);
  }
}
