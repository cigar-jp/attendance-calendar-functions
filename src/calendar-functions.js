function processAllUsers() {
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
    addEventsFromSpreadsheet(user);
  });

  Logger.log('全ユーザーの処理が完了しました');
}

/**
 * スプレッドシートからデータを取得し、Google カレンダーにイベントとして登録する
 * ※A列がプロパティで指定された名前の行のみ処理します。
 */
function addEventsFromSpreadsheet(user) {
  // プロジェクトのスクリプト プロパティから定数を取得
  const scriptProperties = PropertiesService.getScriptProperties();
  const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID'); // スプレッドシートID
  const targetName = user.name; // 処理対象の名前
  const calendarId = user.email; // カレンダーID

  if (!user || !spreadsheetId) {
    Logger.log(
      'プロジェクトのプロパティにSPREADSHEET_ID が設定されていません。',
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

  // 基準日（必要に応じて調整）
  const thresholdDate = new Date('2025-03-14');

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

    // 日付文字列から Date オブジェクトに変換
    const eventDate = new Date(dateStr);
    // 基準日より前の日付の場合はスキップ（必要に応じてコメント解除）
    // if (eventDate < thresholdDate) {
    //   Logger.log('行 ' + (index + 1) + `：${thresholdDate}より前の日付のためスキップ`);
    //   return;
    // }

    // D列：スケジュール雛形ID を取得
    const scheduleTemplateId = String(row[3]).trim();
    // E列：出勤予定時刻、F列：退勤予定時刻を取得
    let startTimeStr = row[4];
    let endTimeStr = row[5];

    if (scheduleTemplateId !== '0' && (!startTimeStr || !endTimeStr)) {
      Logger.log(
        '行 ' +
          (index + 1) +
          '：出勤予定時刻または退勤予定時刻が空のためスキップ',
      );
      return;
    }

    let title = '';
    if (scheduleTemplateId === '0') {
      // スケジュール雛形IDが0の場合は「公休」
      title = '公休';
      Logger.log(
        '行 ' + (index + 1) + '：スケジュール雛形IDが0のためタイトルは「公休」',
      );
    } else {
      // 出勤・退勤時刻がDateオブジェクトの場合は文字列に変換
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

      // その他の場合は勤務時間のタイトル（例："10-19"）
      const startDecimal = convertTimeStringToDecimal(startTimeStr);
      const endDecimal = convertTimeStringToDecimal(endTimeStr);
      title = startDecimal + '-' + endDecimal;
      Logger.log('行 ' + (index + 1) + '：勤務時間タイトル作成: ' + title);
    }

    // ★ 元々の終日イベント作成（1日1件）
    const existingFullDay = calendar
      .getEventsForDay(eventDate)
      .filter((event) => event.isAllDayEvent() && event.getTitle() === title);
    if (existingFullDay.length === 0) {
      calendar.createAllDayEvent(title, eventDate, {
        reminders: { useDefault: false, overrides: [] },
      });
      Logger.log(
        '行 ' +
          (index + 1) +
          '：終日イベント作成: ' +
          eventDate.toDateString() +
          ' / タイトル: ' +
          title,
      );
    } else {
      Logger.log(
        '行 ' +
          (index + 1) +
          '：既に同タイトルの終日イベントが存在するためスキップ',
      );
    }

    // ★ 勤務時間がある場合のみ、午前・午後の業務時間外イベント（createEvent）を作成
    if (scheduleTemplateId !== '0') {
      // 出勤・退勤時刻の Date オブジェクトを生成
      const startParts = startTimeStr.split(':');
      const endParts = endTimeStr.split(':');
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

      // 午前の業務外イベント：0:00～出勤時刻
      let dayStart = new Date(eventDate);
      dayStart.setHours(0, 0, 0, 0);
      const morningEvents = calendar.getEvents(dayStart, workingStartTime, {
        search: '業務時間外',
      });
      if (morningEvents.length === 0) {
        calendar.createEvent('業務時間外', dayStart, workingStartTime, {
          reminders: { useDefault: false, overrides: [] },
        });
        Logger.log(
          '行 ' +
            (index + 1) +
            '：午前の業務時間外イベント作成（0～' +
            startTimeStr +
            '）',
        );
      } else {
        Logger.log(
          '行 ' + (index + 1) + '：午前の業務時間外イベントは既に存在',
        );
      }

      // 午後の業務外イベント：退勤時刻～24:00（翌日0:00）
      let dayEnd = new Date(eventDate);
      dayEnd.setHours(24, 0, 0, 0);
      const afternoonEvents = calendar.getEvents(workingEndTime, dayEnd, {
        search: '業務時間外',
      });
      if (afternoonEvents.length === 0) {
        calendar.createEvent('業務時間外', workingEndTime, dayEnd, {
          reminders: { useDefault: false, overrides: [] },
        });
        Logger.log(
          '行 ' +
            (index + 1) +
            '：午後の業務時間外イベント作成（' +
            endTimeStr +
            '～24:00）',
        );
      } else {
        Logger.log(
          '行 ' + (index + 1) + '：午後の業務時間外イベントは既に存在',
        );
      }
    }
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
  Logger.log('convertTimeStringToDecimal: ' + timeStr);

  if (timeStr instanceof Date) {
    timeStr = Utilities.formatDate(
      timeStr,
      Session.getScriptTimeZone(),
      'HH:mm',
    );
    Logger.log('変換後の timeStr: ' + timeStr);
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
