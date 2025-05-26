/**
 * スプレッドシート取得ヘルパー
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  );
}

/**
 * 差分を抽出する
 */
function extractDifferences(monthPrefix) {
  const ss = getSpreadsheet();

  const yesterdaySheet = ss.getSheetByName(monthPrefix + '昨日分');
  const todaySheet = ss.getSheetByName(monthPrefix + '今日分');

  if (!yesterdaySheet || !todaySheet) {
    const error = new Error('必要なシートが見つかりません');
    error.details = {
      monthPrefix,
      hasYesterday: !!yesterdaySheet,
      hasToday: !!todaySheet,
    };
    throw error;
  }

  const yesterdayData = yesterdaySheet.getDataRange().getValues();
  const todayData = todaySheet.getDataRange().getValues();

  // 差分を格納する配列
  const differences = [];
  let loggedFirst = false;

  // データをMap化して検索を高速化
  const yesterdayMap = new Map();
  for (let i = 1; i < yesterdayData.length; i++) {
    const row = yesterdayData[i];
    const [name, , date] = row;
    const nameKey = String(name).trim();
    const dateKey = date instanceof Date ? date.getTime() : date;
    yesterdayMap.set(`${nameKey}_${dateKey}`, row);
  }

  const todayMap = new Map();
  for (let i = 1; i < todayData.length; i++) {
    const row = todayData[i];
    const [name, , date] = row;
    const nameKey = String(name).trim();
    const dateKey = date instanceof Date ? date.getTime() : date;
    todayMap.set(`${nameKey}_${dateKey}`, row);
  }
  Logger.log(monthPrefix);
  Logger.log(yesterdayMap.size);
  Logger.log(todayMap.size);

  // 今日のデータを処理
  for (const [key, todayRow] of todayMap.entries()) {
    const yRow = yesterdayMap.get(key);
    const yTemplate = yRow ? String(yRow[5]).trim() : null;
    const yStart = yRow
      ? yRow[6] instanceof Date
        ? yRow[6].getTime()
        : yRow[6]
      : null;
    const yEnd = yRow
      ? yRow[7] instanceof Date
        ? yRow[7].getTime()
        : yRow[7]
      : null;
    const tTemplate = String(todayRow[5]).trim();
    const tStart =
      todayRow[6] instanceof Date ? todayRow[6].getTime() : todayRow[6];
    const tEnd =
      todayRow[7] instanceof Date ? todayRow[7].getTime() : todayRow[7];
    // 完全一致する場合は差分に含めない
    if (yRow && JSON.stringify(yRow) === JSON.stringify(todayRow)) {
      continue;
    }
    if (
      !yRow ||
      yTemplate !== tTemplate ||
      yStart !== tStart ||
      yEnd !== tEnd
    ) {
      if (!loggedFirst) {
        Logger.log('first diff key: ' + key);
        Logger.log(
          'first diff yesterday: ' + JSON.stringify(yesterdayMap.get(key))
        );
        Logger.log('first diff today: ' + JSON.stringify(todayRow));
        loggedFirst = true;
      }
      differences.push(todayRow);
    }
  }

  // 昨日あって今日ない予定を検出（削除された予定）
  for (const [key, yesterdayRow] of yesterdayMap.entries()) {
    if (!todayMap.has(key)) {
      // 削除マーカーを付与して差分に追加
      yesterdayRow.push('DELETE');
      differences.push(yesterdayRow);
    }
  }

  Logger.log('differences: ' + differences.length);

  // 差分があれば新しいシートとして保存
  if (differences.length > 0) {
    // ヘッダーを含めてシートに保存（ヘッダー行は昨日シートの1行目を再利用）
    const headers = yesterdayData[0];
    const month = parseInt(monthPrefix.match(/(\d+)月/)[1], 10);
    const sheetName = `Diff_${month}月`;
    const existing = ss.getSheetByName(sheetName);
    if (existing) ss.deleteSheet(existing);
    const newDiffSheet = ss.insertSheet(sheetName);
    newDiffSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    newDiffSheet
      .getRange(2, 1, differences.length, differences[0].length)
      .setValues(differences);
  }

  return differences;
}

function processAllUsers(diffData) {
  // 差分データがない場合は処理を終了
  if (!diffData || diffData.length === 0) {
    Logger.log('処理対象のデータがありません');
    return;
  }

  // ユーザーマップ
  const usersMap = [
    { name: '福田 真一', email: 's.fukuda@izumogroup.co.jp' },
    { name: '塩田 敬子', email: 't.shioda@izumogroup.co.jp' },
    { name: '坪井 彩華', email: 'a.tsuboi@izumogroup.co.jp' },
    { name: '南 沙希子', email: 's.minami@izumogroup.co.jp' },
    { name: '番場 舞', email: 'm.banba@izumogroup.co.jp' },
    { name: '齊藤 祐哉', email: 'y.saito@izumogroup.co.jp' },
    { name: '安井 誇美', email: 'k.yasui@izumogroup.co.jp' },
    { name: '河井 咲良', email: 's.kawai@yakumogeihinkan.jp' },
    { name: '岩永 千佳', email: 'c.iwanaga@yakumogeihinkan.jp' },
    { name: '吉池 紗江', email: 's.yoshiike@yakumogeihinkan.jp' },
    { name: '吉田 良', email: 'r.yoshida@izumogroup.co.jp' },
    { name: '久保 紅生', email: 'a.kubo@yakumogeihinkan.jp' },
    { name: '細川 星七', email: 's.hosokawa@izumogroup.jp' },
    { name: '山口 聖一', email: 's.yamaguchi@izumogroup.jp' },
    { name: '小川 航輝', email: 'k.ogawa@yakumogeihinkan.jp' },
    { name: '小嶋 未由璃', email: 'm.kojima@yakumogeihinkan.jp' },
    { name: '森下 桜', email: 's.morishita@yakumogeihinkan.jp' },
    { name: '中井 啓子', email: 'k.nakai@yakumogeihinkan.jp' },
    { name: '渡邉 美優', email: 'm.watanabe@yakumogeihinkan.jp' },
    { name: '堂本 和希', email: 'k.domoto@izumogroup.jp' },
    { name: '馬場 康成', email: 'y.baba@izumogroup.co.jp' },
    { name: '平澤 莉奈', email: 'r.hirasawa@izumogroup.jp' },
    { name: '牧野 吉泰', email: 'y.makino@yakumogeihinkan.jp' },
    { name: '林 龍矢', email: 'r.hayashi@izumogroup.jp' },
    { name: '竹澤 将', email: 's.takezawa@yakumogeihinkan.jp' },
    { name: '高橋 楓美花', email: 'f.takahashi@yakumogeihinkan.jp' },
    { name: '千崎奈緒美', email: 'n.senzaki@izumogroup.co.jp' },
    { name: '辻岡 沙織', email: 's.tsujioka@yakumogeihinkan.jp' },
    { name: '佐野 日奈子', email: 'h.sano@medelbeauty.jp' },
    { name: '柴山 佳奈', email: 'k.shibayama@medelbeauty.jp' },
    { name: '桒原 未来', email: 'm.kuwabara@medelbeauty.jp' },
  ];

  // 各ユーザーごとに処理
  usersMap.forEach((user) => {
    Logger.log('処理開始: ' + user.name + ' (' + user.email + ')');
    // イベント追加処理を実行
    addEventsFromSpreadsheet(user, diffData);
  });

  Logger.log('全ユーザーの処理が完了しました');
}

/**
 * スプレッドシートからデータを取得し、Google カレンダーにイベントとして登録する
 * ※A列がプロパティで指定された名前の行のみ処理します。
 */
function addEventsFromSpreadsheet(user, diffData) {
  // バリデーションチェック
  if (!validateInputs(user)) return;

  // カレンダーの取得
  const calendar = CalendarApp.getCalendarById(user.email);
  if (!calendar) {
    Logger.log('指定のカレンダーが見つかりません: ' + user.email);
    return;
  }

  // ユーザーの差分データを抽出
  const filteredData = diffData.filter(
    (row) => String(row[0]).trim() === user.name
  );
  if (filteredData.length === 0) {
    Logger.log(`${user.name}の処理対象データが0件のため、処理を終了します。`);
    return;
  }

  // フィルタ済みデータを処理
  filteredData.forEach((row, index) => {
    const rowNum = index + 1;

    // 基本データの検証
    const eventDetails = validateEventData(row, rowNum);
    if (!eventDetails) return;

    const { eventDate, scheduleTemplateId, startTimeStr, endTimeStr } =
      eventDetails;

    // イベントタイトルの生成
    const title = generateEventTitle(
      scheduleTemplateId,
      startTimeStr,
      endTimeStr
    );

    // 終日イベントの処理
    processFullDayEvent(calendar, eventDate, title, rowNum);

    // 勤務時間外イベント処理
    if (scheduleTemplateId === '0') {
      // 公休日の場合、9:00-21:00まで業務時間外イベント作成
      const holidayStart = new Date(eventDate);
      holidayStart.setHours(9, 0, 0, 0);
      const holidayEnd = new Date(eventDate);
      holidayEnd.setHours(21, 0, 0, 0);
      const events = calendar.getEvents(holidayStart, holidayEnd, {
        search: '業務時間外',
      });
      if (events.length === 0) {
        calendar.createEvent('業務時間外', holidayStart, holidayEnd, {
          reminders: { useDefault: false, overrides: [] },
        });
        Logger.log(`行 ${rowNum}：公休の業務時間外イベント作成（9:00～21:00）`);
      } else {
        events.forEach((event) => {
          if (
            event.getTitle() === '業務時間外' &&
            (event.getStartTime().getTime() !== holidayStart.getTime() ||
              event.getEndTime().getTime() !== holidayEnd.getTime())
          ) {
            event.setTime(holidayStart, holidayEnd);
            Logger.log(
              `行 ${rowNum}：公休の業務時間外イベント更新（9:00～21:00）`
            );
          }
        });
      }
    } else {
      processWorkingHoursEvents(
        calendar,
        eventDate,
        startTimeStr,
        endTimeStr,
        rowNum
      );
    }
  });
}

/**
 * 入力データの基本バリデーション
 */
function validateInputs(user) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');

  if (!user || !spreadsheetId) {
    Logger.log('必要なプロパティが設定されていません。');
    return false;
  }
  return true;
}

/**
 * イベントデータの検証
 */
function validateEventData(row, rowNum) {
  const dateStr = row[2];
  if (!dateStr) {
    Logger.log(`行 ${rowNum}：日付が空のためスキップ`);
    return null;
  }

  const eventDate = new Date(dateStr);
  const scheduleTemplateId = String(row[5]).trim();
  let startTimeStr = row[6];
  let endTimeStr = row[7];

  if (scheduleTemplateId !== '0' && (!startTimeStr || !endTimeStr)) {
    Logger.log(
      `行 ${rowNum}：出勤予定時刻または退勤予定時刻が空のためスキップ`
    );
    return null;
  }

  // 時刻フォーマットの統一
  if (startTimeStr instanceof Date) {
    startTimeStr = Utilities.formatDate(
      startTimeStr,
      Session.getScriptTimeZone(),
      'HH:mm'
    );
  }
  if (endTimeStr instanceof Date) {
    endTimeStr = Utilities.formatDate(
      endTimeStr,
      Session.getScriptTimeZone(),
      'HH:mm'
    );
  }

  return { eventDate, scheduleTemplateId, startTimeStr, endTimeStr };
}

/**
 * イベントタイトルの生成
 */
function generateEventTitle(scheduleTemplateId, startTimeStr, endTimeStr) {
  if (scheduleTemplateId === '0') return '公休';

  const startDecimal = convertTimeStringToDecimal(startTimeStr);
  const endDecimal = convertTimeStringToDecimal(endTimeStr);
  return `${startDecimal}-${endDecimal}`;
}

/**
 * 終日イベントの処理
 */
function processFullDayEvent(calendar, eventDate, title, rowNum) {
  const existingFullDay = calendar
    .getEventsForDay(eventDate)
    .filter((event) => event.isAllDayEvent());

  if (existingFullDay.length === 0) {
    calendar.createAllDayEvent(title, eventDate, {
      reminders: { useDefault: false, overrides: [] },
    });
    Logger.log(
      `行 ${rowNum}：終日イベント作成: ${eventDate.toDateString()} / タイトル: ${title}`
    );
    return;
  }

  const regex = /^(公休|\d+(\.\d+)?-\d+(\.\d+)?)$/;
  let updated = false;

  existingFullDay.forEach((event) => {
    const currentTitle = event.getTitle();
    if (regex.test(currentTitle) && currentTitle !== title) {
      event.setTitle(title);
      Logger.log(
        `行 ${rowNum}：既存イベントのタイトルを更新しました: ${title}`
      );
      updated = true;
    }
  });

  if (!updated) {
    Logger.log(`行 ${rowNum}：既存の終日イベントは更新不要です`);
  }
}

/**
 * 業務時間外イベントの処理
 */
function processWorkingHoursEvents(
  calendar,
  eventDate,
  startTimeStr,
  endTimeStr,
  rowNum
) {
  const times = calculateWorkingTimes(eventDate, startTimeStr, endTimeStr);

  // 午前の業務時間外イベント処理
  processPeriodEvent(
    calendar,
    times.dayStart,
    times.workingStartTime,
    rowNum,
    '午前'
  );

  // 午後の業務時間外イベント処理
  processPeriodEvent(
    calendar,
    times.workingEndTime,
    times.dayEnd,
    rowNum,
    '午後'
  );
}

/**
 * 業務時間の計算
 */
function calculateWorkingTimes(eventDate, startTimeStr, endTimeStr) {
  const startParts = startTimeStr.split(':');
  const endParts = endTimeStr.split(':');

  let dayStart = new Date(eventDate);
  dayStart.setHours(0, 0, 0, 0);

  let dayEnd = new Date(eventDate);
  dayEnd.setHours(24, 0, 0, 0);

  let workingStartTime = new Date(eventDate);
  workingStartTime.setHours(
    parseInt(startParts[0], 10),
    parseInt(startParts[1], 10),
    0,
    0
  );

  let workingEndTime = new Date(eventDate);
  workingEndTime.setHours(
    parseInt(endParts[0], 10),
    parseInt(endParts[1], 10),
    0,
    0
  );

  return { dayStart, dayEnd, workingStartTime, workingEndTime };
}

/**
 * 特定期間のイベント処理（午前・午後共通）
 */
function processPeriodEvent(calendar, startTime, endTime, rowNum, period) {
  const events = calendar.getEvents(startTime, endTime, {
    search: '業務時間外',
  });
  const timeStr =
    period === '午前'
      ? `0～${Utilities.formatDate(
          endTime,
          Session.getScriptTimeZone(),
          'HH:mm'
        )}`
      : `${Utilities.formatDate(
          startTime,
          Session.getScriptTimeZone(),
          'HH:mm'
        )}～24:00`;

  if (events.length === 0) {
    calendar.createEvent('業務時間外', startTime, endTime, {
      reminders: { useDefault: false, overrides: [] },
    });
    Logger.log(`行 ${rowNum}：${period}の業務時間外イベント作成（${timeStr}）`);
    return;
  }

  const regex = /^業務時間外$/;
  let updated = false;

  events.forEach((event) => {
    if (regex.test(event.getTitle())) {
      const currentStart = event.getStartTime();
      const currentEnd = event.getEndTime();

      if (
        currentStart.getTime() !== startTime.getTime() ||
        currentEnd.getTime() !== endTime.getTime()
      ) {
        event.setTime(startTime, endTime);
        Logger.log(
          `行 ${rowNum}：${period}の業務時間外イベント更新（新: ${timeStr}）`
        );
        updated = true;
      }
    }
  });

  if (!updated) {
    Logger.log(
      `行 ${rowNum}：${period}の業務時間外イベントは既に最新の状態です`
    );
  }
}

/**
 * 時刻文字列を小数表記の文字列に変換する関数
 * 例: "9:00" → "9", "20:30" → "20.5"
 *
 * @param {string} timeStr - "HH:mm" 形式の文字列
 * @return {string} 小数表記の時刻文字列
 */
function convertTimeStringToDecimal(timeStr) {
  // Dateオブジェクトの場合は文字列に変換
  if (timeStr instanceof Date) {
    timeStr = Utilities.formatDate(
      timeStr,
      Session.getScriptTimeZone(),
      'HH:mm'
    );
  }

  const parts = timeStr.split(':');
  if (parts.length !== 2) return timeStr;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (minutes === 0) {
    return hours.toString();
  } else if (minutes === 30) {
    return hours + '.5';
  } else {
    return (hours + minutes / 60).toFixed(2);
  }
}

/**
 * トリガーの設定を行う関数
 */
function processSheets() {
  const ss = getSpreadsheet();
  const today = new Date();
  const prefix = `${today.getMonth() + 1}月_`;
  let diffData;
  const yesterdaySheet = ss.getSheetByName(prefix + '昨日分');
  const todaySheet = ss.getSheetByName(prefix + '今日分');
  if (!todaySheet) {
    Logger.log('シートが見つかりません: ' + prefix + '今日分');
    return;
  }
  if (!yesterdaySheet) {
    const values = todaySheet.getDataRange().getValues();
    diffData = values.slice(1);
  } else {
    try {
      diffData = extractDifferences(prefix);
    } catch (e) {
      Logger.log('差分抽出でエラー: ' + e.toString());
      return;
    }
  }
  if (diffData && diffData.length > 0) {
    // 差分データを新規シートに書き込み
    const diffSheetName = prefix + '差分';
    const existingSheet = ss.getSheetByName(diffSheetName);
    if (existingSheet) ss.deleteSheet(existingSheet);
    const newSheet = ss.insertSheet(diffSheetName);
    newSheet
      .getRange(1, 1, diffData.length, diffData[0].length)
      .setValues(diffData);
    processAllUsers(diffData);
  } else {
    Logger.log('差分がありませんでした');
  }
}

function setupTrigger() {
  // タイムゾーンをログ出力
  const tz = Session.getScriptTimeZone();
  Logger.log('設定するタイムゾーン: ' + tz);

  // 既存のトリガーを全て削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'processSheets') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 新しいトリガーを作成（毎日午前6時に実行）
  ScriptApp.newTrigger('processSheets')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .inTimezone(tz)
    .create();

  // エラー通知の設定
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(
    'NOTIFICATION_EMAIL',
    'izm.master@izumogroup.co.jp'
  );
}

/**
 * テスト用：純粋な差分抽出ロジック
 */
function extractDifferencesFromArrays(yesterdayData, todayData) {
  const differences = [];
  const ym = new Map();
  for (let i = 1; i < yesterdayData.length; i++) {
    const row = yesterdayData[i];
    const [name, , date] = row;
    ym.set(`${name}_${date}`, row.slice());
  }
  const tm = new Map();
  for (let i = 1; i < todayData.length; i++) {
    const row = todayData[i];
    const [name, , date] = row;
    tm.set(`${name}_${date}`, row.slice());
  }
  // 追加・変更検出
  for (const [key, row] of tm.entries()) {
    const yRow = ym.get(key);
    if (
      !yRow ||
      yRow[5] !== row[5] ||
      yRow[6] !== row[6] ||
      yRow[7] !== row[7]
    ) {
      differences.push(row.slice());
    }
  }
  // 削除検出
  for (const [key, row] of ym.entries()) {
    if (!tm.has(key)) {
      const delRow = row.slice();
      delRow.push('DELETE');
      differences.push(delRow);
    }
  }
  return differences;
}
