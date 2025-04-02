/**
 * メールから最新の勤怠データを取得し処理する
 */
async function processLatestAttendanceData() {
  try {
    // メールを検索
    const query =
      'label:jinjer勤怠 subject:"【jinjer勤怠】汎用データ_ダウンロード処理完了通知"';
    const threads = GmailApp.search(query);

    if (threads.length === 0) {
      Logger.log('対象のメールが見つかりません');
      return;
    }

    // 今日の日付を取得
    const today = new Date();
    const todayStr = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy/MM/dd');

    // 最新2件のメールを処理
    const latestMails = threads
      .slice(0, 2)
      .map((thread) => thread.getMessages()[thread.getMessageCount() - 1]);

    for (const mail of latestMails) {
      const receivedDate = mail.getDate();
      const receivedDateStr = Utilities.formatDate(
        receivedDate,
        'Asia/Tokyo',
        'yyyy/MM/dd',
      );

      // 今日受信したメールのみ処理
      if (receivedDateStr !== todayStr) {
        continue;
      }

      const attachments = mail.getAttachments();
      const foundAttachment = attachments.find((attachment) =>
        attachment
          .getName()
          .startsWith('汎用データ(まるめ適用後)ダウンロード_'),
      );

      if (!foundAttachment) {
        Logger.log('対象のCSVファイルが見つかりません');
        continue;
      }

      try {
        // ZIPファイルを解凍
        const zipBlob = foundAttachment.copyBlob();
        const zipData = zipBlob.getBytes();

        // Zlibを使用してZIPを解凍
        const unzip = new Zlib.Unzip(zipData);
        const filenames = unzip.getFilenames();

        // CSVファイルを探す
        const csvFile = filenames.find((name) =>
          name.startsWith('汎用データ(まるめ適用後)ダウンロード_'),
        );

        if (!csvFile) {
          Logger.log('CSVファイルが見つかりません');
          continue;
        }

        // CSVを解凍してShiftJISでデコード
        const csvData = unzip.decompress(csvFile);
        const csvString =
          Utilities.newBlob(csvData).getDataAsString('Shift_JIS');

        // CSVの妥当性チェック
        if (!csvString.includes('従業員番号')) {
          Logger.log('CSVデータの形式が不正です');
          continue;
        }

        const formattedData = formatCsvData(csvString);

        // CSVデータから対象月を判定
        const months = getDataMonths(csvString);
        if (!months || months.length === 0) {
          Logger.log('CSVデータから月の判定ができません');
          continue;
        }

        Logger.log(`処理対象の月: ${months.join(', ')}月`);

        // シートを更新し、差分データを取得
        const allDiffData = [];
        for (const month of months) {
          const monthlyData = filterDataByMonth(formattedData, month);
          if (monthlyData.length > 0) {
            const monthPrefix = getMonthPrefix(month);
            updateSheets(monthlyData, monthPrefix);

            try {
              const diffData = extractDifferences(monthPrefix);
              if (diffData && diffData.length > 0) {
                allDiffData.push(...diffData);
              }
            } catch (error) {
              if (error.details && !error.details.hasYesterday) {
                // 昨日分のシートがない場合は全データを差分として扱う
                Logger.log(
                  `${month}月の昨日分シートがないため、全データを処理します`,
                );
                allDiffData.push(...monthlyData.slice(1)); // ヘッダーを除く
              } else {
                throw error;
              }
            }
          }
        }

        if (allDiffData.length > 0) {
          // カレンダー更新を実行
          processAllUsers(allDiffData);
        } else {
          Logger.log('処理対象の差分は検出されませんでした');
        }
      } catch (error) {
        Logger.log('処理中にエラーが発生しました: ' + error.message);
        if (error.details) {
          Logger.log('エラー詳細: ' + JSON.stringify(error.details));
        }
        continue;
      }
    }
  } catch (error) {
    Logger.log('エラーが発生しました: ' + error.message);
    if (error.details) {
      Logger.log('エラー詳細: ' + JSON.stringify(error.details));
    }
    throw error;
  }
}

/**
 * CSVデータから対象月を抽出する
 */
function getDataMonths(csvData) {
  const rows = Utilities.parseCsv(csvData);
  if (rows.length < 2) return null;

  // ヘッダーを除いた全データの日付を取得
  const dates = rows.slice(1).map((row) => new Date(row[2]));

  // ユニークな月を抽出（例：[4, 5]）
  const months = [...new Set(dates.map((date) => date.getMonth() + 1))];
  return months.sort((a, b) => a - b);
}

/**
 * 月に基づいてデータをフィルタリング
 */
function filterDataByMonth(data, targetMonth) {
  return data.filter((row) => {
    if (row.length < 3) return false;
    const date = new Date(row[2]);
    return date.getMonth() + 1 === targetMonth;
  });
}

/**
 * 月に基づいてシート名のプレフィックスを決定
 */
function getMonthPrefix(month) {
  return `${month}月_`;
}

/**
 * CSVデータを整形する
 */
function formatCsvData(csvString) {
  const rows = Utilities.parseCsv(csvString);

  // ヘッダー行を取得し、I列以降を除外
  const headers = rows[0].slice(0, 8);

  // データ行を処理
  return rows.slice(1).map((row) => {
    const formattedRow = row.slice(0, 8); // I列以降を除外
    return formattedRow;
  });
}

/**
 * シートの更新処理
 */
function updateSheets(monthData, monthPrefix) {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'),
  );

  // 既存のシートを更新
  const yesterdaySheet = ss.getSheetByName(monthPrefix + '昨日分');
  const todaySheet = ss.getSheetByName(monthPrefix + '今日分');

  if (todaySheet) {
    if (yesterdaySheet) {
      yesterdaySheet.clear();
    }
    // 今日分を昨日分にコピー
    const newYesterdaySheet = todaySheet.copyTo(ss);
    newYesterdaySheet.setName(monthPrefix + '昨日分');

    // 既存の今日分を削除
    ss.deleteSheet(todaySheet);
  }

  // 新しいデータを今日分として保存
  const newTodaySheet = ss.insertSheet(monthPrefix + '今日分');
  newTodaySheet
    .getRange(1, 1, monthData.length, monthData[0].length)
    .setValues(monthData);
}

/**
 * 差分を抽出する
 */
function extractDifferences(monthPrefix) {
  const ss = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'),
  );

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

  // 今日のデータを処理
  for (let i = 1; i < todayData.length; i++) {
    const todayRow = todayData[i];
    const key = `${todayRow[0]}_${todayRow[2]}`; // 名前と日付の組み合わせ

    // 昨日のデータから対応する行を探す
    const yesterdayRow = yesterdayData.find(
      (row, index) => index > 0 && `${row[0]}_${row[2]}` === key,
    );

    // 新規登録または変更があった場合
    if (
      !yesterdayRow ||
      yesterdayRow[5] !== todayRow[5] || // スケジュールテンプレートID
      yesterdayRow[6] !== todayRow[6] || // 出勤予定時刻
      yesterdayRow[7] !== todayRow[7] // 退勤予定時刻
    ) {
      differences.push(todayRow);
    }
  }

  // 昨日あって今日ない予定を検出（削除された予定）
  for (let i = 1; i < yesterdayData.length; i++) {
    const yesterdayRow = yesterdayData[i];
    const key = `${yesterdayRow[0]}_${yesterdayRow[2]}`; // 名前と日付の組み合わせ

    // 今日のデータに存在しない場合
    const exists = todayData.some(
      (row, index) => index > 0 && `${row[0]}_${row[2]}` === key,
    );

    if (!exists) {
      // 削除マーカーを付与して差分に追加
      yesterdayRow.push('DELETE');
      differences.push(yesterdayRow);
    }
  }

  // 差分があれば新しいシートとして保存
  if (differences.length > 0) {
    const month = parseInt(monthPrefix.match(/(\d+)月/)[1]);
    const sheetName = `Sheet1_${month}月`;
    const diffSheet = ss.getSheetByName(sheetName);
    if (diffSheet) {
      ss.deleteSheet(diffSheet);
    }
    const newDiffSheet = ss.insertSheet(sheetName);
    newDiffSheet
      .getRange(1, 1, differences.length, differences[0].length)
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
    (row) => String(row[0]).trim() === user.name,
  );
  if (filteredData.length === 0) {
    Logger.log(`${user.name}の処理対象データが0件のため、処理を終了します。`);
    return;
  }

  // 基準日（必要に応じて調整）
  const thresholdDate = new Date('2025-03-14');

  // フィルタ済みデータを処理
  filteredData.forEach((row, index) => {
    const rowNum = index + 1;

    // 基本データの検証
    const eventDetails = validateEventData(row, rowNum);
    if (!eventDetails) return;

    const { eventDate, scheduleTemplateId, startTimeStr, endTimeStr } =
      eventDetails;
    // 基準日より前の日付の場合はスキップ（必要に応じてコメント解除）
    // if (eventDate < thresholdDate) {
    //   Logger.log('行 ' + (index + 1) + `：${thresholdDate}より前の日付のためスキップ`);
    //   return;
    // }

    // イベントタイトルの生成
    const title = generateEventTitle(
      scheduleTemplateId,
      startTimeStr,
      endTimeStr,
    );

    // 終日イベントの処理
    processFullDayEvent(calendar, eventDate, title, rowNum);

    // 勤務時間がある場合の業務時間外イベント処理
    if (scheduleTemplateId !== '0') {
      processWorkingHoursEvents(
        calendar,
        eventDate,
        startTimeStr,
        endTimeStr,
        rowNum,
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
      `行 ${rowNum}：出勤予定時刻または退勤予定時刻が空のためスキップ`,
    );
    return null;
  }

  // 時刻フォーマットの統一
  if (startTimeStr instanceof Date) {
    startTimeStr = Utilities.formatDate(
      startTimeStr,
      Session.getScriptTimeZone(),
      'HH:mm',
    );
  }
  if (endTimeStr instanceof Date) {
    endTimeStr = Utilities.formatDate(
      endTimeStr,
      Session.getScriptTimeZone(),
      'HH:mm',
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
      `行 ${rowNum}：終日イベント作成: ${eventDate.toDateString()} / タイトル: ${title}`,
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
        `行 ${rowNum}：既存イベントのタイトルを更新しました: ${title}`,
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
  rowNum,
) {
  const times = calculateWorkingTimes(eventDate, startTimeStr, endTimeStr);

  // 午前の業務時間外イベント処理
  processPeriodEvent(
    calendar,
    times.dayStart,
    times.workingStartTime,
    rowNum,
    '午前',
  );

  // 午後の業務時間外イベント処理
  processPeriodEvent(
    calendar,
    times.workingEndTime,
    times.dayEnd,
    rowNum,
    '午後',
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
    0,
  );

  let workingEndTime = new Date(eventDate);
  workingEndTime.setHours(
    parseInt(endParts[0], 10),
    parseInt(endParts[1], 10),
    0,
    0,
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
      ? `0～${Utilities.formatDate(endTime, Session.getScriptTimeZone(), 'HH:mm')}`
      : `${Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm')}～24:00`;

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
          `行 ${rowNum}：${period}の業務時間外イベント更新（新: ${timeStr}）`,
        );
        updated = true;
      }
    }
  });

  if (!updated) {
    Logger.log(
      `行 ${rowNum}：${period}の業務時間外イベントは既に最新の状態です`,
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
      'HH:mm',
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
function setupTrigger() {
  // 既存のトリガーを全て削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'processLatestAttendanceData') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 新しいトリガーを作成（毎日午前6時に実行）
  ScriptApp.newTrigger('processLatestAttendanceData')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  // エラー通知の設定
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(
    'NOTIFICATION_EMAIL',
    'izm.master@izumogroup.co.jp',
  );
}
