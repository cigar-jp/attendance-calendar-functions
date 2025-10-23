/****************************************************
 * Jinjer 勤怠 取込～整形～差分処理・配信（当月＋翌月対応）
 * - Gmail → ZIP（Shift_JIS対応）→ CSV → A..H + CH抽出
 * - 月ごとに X月_昨日分 / X月_今日分 をローテーションして上書き
 * - 幂等性：Message-ID＋シート行ハッシュで再実行を安全化
 * - 最後に processSheets() で差分抽出→配信（当月＋翌月両方）
 ****************************************************/

/** ====== 設定値 ====== */
const CFG = {
  SUBJECT: '【jinjer勤怠】汎用データ_ダウンロード処理完了通知',
  GMAIL_QUERY: 'label:jinjer勤怠 subject:"【jinjer勤怠】汎用データ_ダウンロード処理完了通知" from:entry@kintai.jinjer.biz has:attachment filename:zip newer_than:2d',
  PROCESSED_LABEL: 'jinjer/processed',
  NOTIFY_EMAIL: 'izm.master@izumogroup.co.jp',
  SLACK_WEBHOOK_URL: '', // Slack不要なら空のまま
};


/*** ▼▼ テスト専用ユーティリティ ▼▼ ***/

/** テスト用スプレッドシートを開く */
function getSpreadsheetTest() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID_TEST');
  if (!id) throw new Error('SPREADSHEET_ID_TEST が未設定です（スクリプトプロパティに追加してください）');
  return SpreadsheetApp.openById(id);
}

/**
 * 【Dry Run テスト】Gmail→ZIP→CSV（Shift_JIS対応）→A..H+CH抽出→各月 TEST_シートへ書込み
 * - 1スレッド分だけ処理
 * - メールは「既読化」・「ラベル付与」しない（本番の副作用なし）
 * - ハッシュの幂等性チェックや Message-ID 記録もしない（純粋に取り込み確認）
 */
function testIngestFromGmailOnce() {
  const ss = getSpreadsheetTest();

  // 最新1スレッドだけ拾う（CFG.GMAIL_QUERY は本番のを使う。必要なら newer_than を短く）
  const threads = GmailApp.search(CFG.GMAIL_QUERY, 0, 1);
  if (threads.length === 0) {
    Logger.log('[testIngestFromGmailOnce] 対象メールが見つかりません');
    return;
  }

  const th = threads[0];
  const msgs = th.getMessages();
  let processed = 0;

  for (const m of msgs) {
    const atts = m.getAttachments({ includeInlineImages: false, includeAttachments: true }) || [];
    const zips = atts.filter(a => /\.zip$/i.test(a.getName()));
    if (zips.length === 0) continue;

    for (const zipBlob of zips) {
      const unzipped = Utilities.unzip(zipBlob.copyBlob());
      for (const file of unzipped) {
        // 中身でCSV判定（Shift_JIS優先）
        const csvText = decodeCsvText_(file);
        const rows = Utilities.parseCsv(csvText);
        if (!rows || rows.length === 0) continue;

        // A..H + CH だけ残す（ヘッダ含む）
        const shaped = keepAHAndCHColumns(rows);
        const dataOnly = shaped.length > 1 ? shaped.slice(1) : [];
        if (dataOnly.length === 0) continue;

        // 月バケツ（C列= index 2）
        const buckets = bucketByMonth_(dataOnly);
        let info = [];
        buckets.forEach((valuesForMonth, month) => {
          const prefix = `${month}月_TEST_`;
          rotateAndWriteToNamesNoHash_(ss, prefix + '今日分', prefix + '昨日分', valuesForMonth);
          info.push(`${month}月:${valuesForMonth.length}行`);
        });

        Logger.log(`[testIngestFromGmailOnce] 書込み: ${info.join(', ')}`);
        processed++;
      }
    }
    if (processed > 0) break; // 1メール分で終了
  }

  if (processed === 0) {
    Logger.log('[testIngestFromGmailOnce] ZIP/CSV が見つかりませんでした');
  } else {
    Logger.log('[testIngestFromGmailOnce] 完了。テスト用シート（X月_TEST_今日分/昨日分）を確認してください。');
  }
}

/**
 * テスト用：ハッシュ比較なしで rotate & write（TEST_用途）
 */
function rotateAndWriteToNamesNoHash_(ss, todayName, yesterdayName, values) {
  if (!values || values.length === 0) return;

  const today = ss.getSheetByName(todayName);
  if (today) {
    const yesterday = ss.getSheetByName(yesterdayName) || ss.insertSheet(yesterdayName);
    yesterday.clearContents();
    const ex = today.getDataRange().getValues();
    if (ex && ex.length > 0) {
      yesterday.getRange(1, 1, ex.length, ex[0].length).setValues(ex);
    }
    today.clearContents();
  }
  const target = ss.getSheetByName(todayName) || ss.insertSheet(todayName);
  target.getRange(1, 1, values.length, values[0].length).setValues(values);
}

/**
 * （任意）TESTシートを実名にコピーして差分処理を試す
 * - 実行前に「SPREADSHEET_ID」を**テスト用ID**に切替えておくと安全（本番カレンダーに書かれます）
 * - month: 数値（例 10）
 */
function copyTestToRealNamesForMonth(month) {
  const ss = getSpreadsheet();
  const testSs = getSpreadsheetTest();

  const pairs = [
    { from: `${month}月_TEST_今日分`,   to: `${month}月_今日分`   },
    { from: `${month}月_TEST_昨日分`,   to: `${month}月_昨日分`   },
  ];

  pairs.forEach(({from, to}) => {
    const src = testSs.getSheetByName(from);
    if (!src) { Logger.log(`[copyTestToRealNamesForMonth] 見つからない: ${from}`); return; }

    const data = src.getDataRange().getValues();
    let dst = ss.getSheetByName(to) || ss.insertSheet(to);
    dst.clearContents();
    if (data.length > 0) dst.getRange(1, 1, data.length, data[0].length).setValues(data);
    Logger.log(`[copyTestToRealNamesForMonth] コピー: ${from} -> ${to} (${data.length}行)`);
  });

  Logger.log('コピー完了。続けて processSheets() を実行して差分～カレンダーを確認してください。');
}

/**
 * TESTシートの掃除（不要になったら）
 * - 直近2ヶ月だけ消すなど用途に応じて使ってください
 */
function deleteTestSheets(months = []) {
  const ss = getSpreadsheetTest();
  const names = ss.getSheets().map(s => s.getName());
  const targets = names.filter(n => /月_TEST_/.test(n));
  const filtered = months.length
    ? targets.filter(n => months.some(m => n.startsWith(`${m}月_TEST_`)))
    : targets;

  filtered.forEach(name => {
    const sh = ss.getSheetByName(name);
    if (sh) { ss.deleteSheet(sh); Logger.log(`deleted: ${name}`); }
  });
}

/*** ▲▲ テスト専用ユーティリティ ここまで ▲▲ ***/


/** ====== ユーティリティ ====== */

/** スプレッドシート取得（SPREADSHEET_IDはScript Propertiesに保存） */
function getSpreadsheet() {
  return SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  );
}

/** 16進文字列へ */
function toHex_(bytes) {
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/** 値配列のMD5（幂等性チェック用）。大きい配列はJSON文字列化で十分実務的に堅牢 */
function hashValues_(values) {
  const json = JSON.stringify(values || []);
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, json);
  return toHex_(bytes);
}

/** Slack通知（任意） */
function notifySlack_(text) {
  if (!CFG.SLACK_WEBHOOK_URL) return;
  try {
    UrlFetchApp.fetch(CFG.SLACK_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log('Slack通知失敗: ' + e);
  }
}

/** ラベル取得・作成 */
function getOrCreateLabel_(name) {
  const ex = GmailApp.getUserLabelByName(name);
  return ex || GmailApp.createLabel(name);
}

/** CSV Blob → 安全デコード（Shift_JIS優先。失敗時はUTF-8等フォールバック） */
function decodeCsvText_(blob) {
  const tryEncodings = ['Shift_JIS', 'Windows-31J', 'MS932', 'UTF-8'];
  for (const enc of tryEncodings) {
    try {
      const text = blob.getDataAsString(enc);
      if (looksLikeCsv_(text)) return text;
    } catch (e) {}
  }
  return blob.getDataAsString(); // 最後の手段
}

/** ざっくりCSVっぽいか判定 */
function looksLikeCsv_(text) {
  if (!text) return false;
  const lines = text.split(/\r\n|\n/);
  if (lines.length < 2) return false;
  const head = lines[0];
  const comma = (head.match(/,/g) || []).length;
  const tab = (head.match(/\t/g) || []).length;
  return comma >= 1 || tab >= 1;
}

/**
 * A〜H と CH だけ残す（ヘッダー含む2次元配列→同様に返す）
 * - 後段のシート列削除は使わない（配列整形で完結）
 */
function keepAHAndCHColumns(rows) {
  if (!rows || rows.length === 0) return [];
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const kept = [];
    for (let c = 0; c <= 7 && c < row.length; c++) kept.push(row[c]); // A..H
    if (row.length > 85) kept.push(row[85]); // CH
    result.push(kept);
  }
  return result;
}

/**
 * todayName を yesterdayName に退避し、todayName に values を上書き
 * - 幅優先: 1回の setValues で高速化
 * - 幂等性: 書き込み前に既存 today の MD5 と比較し、同一ならスキップ
 * - ハッシュは Script Properties に保存（キー HASH_{todayName}）
 */
function rotateAndWrite_(ss, todayName, yesterdayName, values) {
  if (!values || values.length === 0) return;

  // 既存 today の値を取得してハッシュ比較
  const prop = PropertiesService.getScriptProperties();
  const hashKey = 'HASH_' + todayName;

  /** 現在のtodayのvaluesを取得 */
  const todaySheetExisting = ss.getSheetByName(todayName);
  let existingValues = [];
  if (todaySheetExisting) {
    const rng = todaySheetExisting.getDataRange();
    existingValues = rng ? rng.getValues() : [];
  }

  const newHash = hashValues_(values);
  const oldHash = prop.getProperty(hashKey);

  // 既存と同じならローテ＆書き込みを省略（幂等）
  if (oldHash && oldHash === newHash) {
    Logger.log(`[rotateAndWrite_] skip write (same hash): ${todayName}`);
    return;
  }

  // 退避: 今日分 → 昨日分
  if (todaySheetExisting) {
    const yesterday = ss.getSheetByName(yesterdayName) || ss.insertSheet(yesterdayName);
    yesterday.clearContents();
    if (existingValues && existingValues.length > 0) {
      yesterday.getRange(1, 1, existingValues.length, existingValues[0].length).setValues(existingValues);
    }
    todaySheetExisting.clearContents();
  }

  // 書き込み
  const target = ss.getSheetByName(todayName) || ss.insertSheet(todayName);
  target.getRange(1, 1, values.length, values[0].length).setValues(values);

  // ハッシュ更新
  prop.setProperty(hashKey, newHash);
}

/** 当月・翌月の数値を返す（1-12） */
function getCurrentAndNextMonth_() {
  const today = new Date();
  const cur = today.getMonth() + 1;
  const next = cur === 12 ? 1 : cur + 1;
  return [cur, next];
}

/** rows（データ行）を月ごと（C列= index 2 の日付）にバケツ分け */
function bucketByMonth_(rows) {
  const buckets = new Map(); // month -> rows[]
  for (const r of rows) {
    const d = new Date(r[2]);
    if (isNaN(d)) continue;
    const m = d.getMonth() + 1;
    if (!buckets.has(m)) buckets.set(m, []);
    buckets.get(m).push(r);
  }
  return buckets;
}

/** 例外メール通知 */
function notifyFailure_(where, err) {
  Logger.log(`[${where}] ${err && (err.stack || err)}`);
  MailApp.sendEmail({
    to: CFG.NOTIFY_EMAIL,
    subject: `【自動取込エラー】${where}`,
    htmlBody: `<pre>${(err && (err.stack || err)) || ''}</pre>`,
  });
  notifySlack_(`:warning: 取込エラー at *${where}*\n\`\`\`${(err && (err.stack || err)) || ''}\`\`\``);
}

/** ====== メイン：Gmail→ZIP→CSV→シート ====== */
/**
 * 毎朝の時刻トリガー用：Gmailからzip(csv)を取り込み、A..H+CH抽出し、月ごとに今日分更新→ processSheets()
 * - 当月＋翌月の両方を正しく処理
 * - 既読化＋ラベル付与
 * - Message-ID重複防止
 */
function ingestFromGmail() {
  const label = getOrCreateLabel_(CFG.PROCESSED_LABEL);
  try {
    const ss = getSpreadsheet();
    const threads = GmailApp.search(CFG.GMAIL_QUERY, 0, 20);
    if (threads.length === 0) {
      Logger.log('[ingestFromGmail] no threads');
      processSheets(); // 念のため走らせる（他経路で今日分更新された場合）
      return;
    }

    // 既処理Message-ID集合
    const prop = PropertiesService.getScriptProperties();
    const doneSet = new Set(JSON.parse(prop.getProperty('DONE_MSG_IDS') || '[]'));
    const processedMsgIds = [];

    for (const th of threads) {
      const msgs = th.getMessages();
      for (const m of msgs) {
        const id = m.getId();
        if (doneSet.has(id)) continue;

        const atts = m.getAttachments({ includeInlineImages: false, includeAttachments: true });
        if (!atts || atts.length === 0) continue;

        // zipのみ対象
        const zips = atts.filter(a => /\.zip$/i.test(a.getName()));
        if (zips.length === 0) continue;

        for (const zipBlob of zips) {
          let unzipped;
          try {
            unzipped = Utilities.unzip(zipBlob);
          } catch (e) {
            notifyFailure_('unzip', e);
            continue;
          }

          for (const file of unzipped) {
            // 拡張子文字化けの可能性があるので中身でCSV判定
            let csvText, rows;
            try {
              csvText = decodeCsvText_(file);
              rows = Utilities.parseCsv(csvText);
            } catch (e) {
              notifyFailure_('decode/parseCsv', e);
              continue;
            }

            // A..H + CH のみに整形
            const filtered = keepAHAndCHColumns(rows);
            const dataOnly = filtered.length > 1 ? filtered.slice(1) : [];
            if (dataOnly.length === 0) continue;

            // 月ごとにバケツ
            const buckets = bucketByMonth_(dataOnly);
            buckets.forEach((valuesForMonth, month) => {
              // 当月 or 翌月のみ受け付けたい場合はここでフィルタ
              // 今回は両方OK（=その他の月は無視）
              const [cur, nxt] = getCurrentAndNextMonth_();
              if (month !== cur && month !== nxt) {
                Logger.log(`[ingestFromGmail] skip month=${month} (only cur/next)`);
                return;
              }
              const prefix = `${month}月_`;
              rotateAndWrite_(ss, prefix + '今日分', prefix + '昨日分', valuesForMonth);
            });
          }
        }

        th.addLabel(label);
        m.markRead();
        processedMsgIds.push(id);
      }
    }

    // Message-ID 永続化（最近500件）
    if (processedMsgIds.length > 0) {
      const union = new Set([...doneSet, ...processedMsgIds]);
      prop.setProperty('DONE_MSG_IDS', JSON.stringify(Array.from(union).slice(-500)));
    }

    // 取り込み完了後に差分処理・配信
    processSheets();

  } catch (err) {
    notifyFailure_('ingestFromGmail', err);
    throw err;
  }
}

/** ====== 差分抽出・配信（当月＋翌月） ====== */
/**
 * 既存の processSheets を**月対応**に拡張
 * - 「当月」「翌月」の2つの prefix について、それぞれ実行
 * - 既存の extractDifferences, processAllUsers を**そのまま活用**
 * - 差分シート作成は extractDifferences() 内の仕様（Diff_{月}月）を踏襲
 */
function processSheets() {
  const ss = getSpreadsheet();
  const [curMonth, nextMonth] = getCurrentAndNextMonth_();
  const targetMonths = [curMonth, nextMonth];

  targetMonths.forEach(month => {
    const prefix = `${month}月_`;
    let diffData;
    const yesterdaySheet = ss.getSheetByName(prefix + '昨日分');
    const todaySheet = ss.getSheetByName(prefix + '今日分');

    if (!todaySheet) {
      Logger.log(`[processSheets] シートが見つかりません: ${prefix}今日分`);
      return;
    }

    if (!yesterdaySheet) {
      // 昨日分が無ければ、今日分全量を差分として扱う
      const values = todaySheet.getDataRange().getValues();
      diffData = values.length > 1 ? values.slice(1) : [];
    } else {
      try {
        diffData = extractDifferences(prefix);
      } catch (e) {
        Logger.log(`[processSheets] 差分抽出エラー (${prefix}): ` + e.toString());
        return;
      }
    }

    if (diffData && diffData.length > 0) {
      // 差分のブレークダウン（従来と同じ命名へ合わせる）
      const diffSheetName = prefix + '差分';
      const existingSheet = ss.getSheetByName(diffSheetName);
      if (existingSheet) ss.deleteSheet(existingSheet);
      const newSheet = ss.insertSheet(diffSheetName);
      newSheet.getRange(1, 1, diffData.length, diffData[0].length).setValues(diffData);

      // 既存のユーザー配信ロジック
      processAllUsers(diffData);
    } else {
      Logger.log(`[processSheets] 差分なし: ${prefix}`);
    }
  });
}

/** ====== 既存の差分抽出・配信ロジック（軽微調整 or そのまま） ====== */

/**
 * 差分を抽出する（既存関数そのまま）
 * - monthPrefix: "3月_" のような接頭辞
 * - Diff_{月}月 シートを作成（既存仕様）
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

  const differences = [];
  let loggedFirst = false;

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

  // 追加・変更
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

    if (yRow && JSON.stringify(yRow) === JSON.stringify(todayRow)) {
      continue;
    }
    if (!yRow || yTemplate !== tTemplate || yStart !== tStart || yEnd !== tEnd) {
      if (!loggedFirst) {
        Logger.log('first diff key: ' + key);
        Logger.log('first diff yesterday: ' + JSON.stringify(yesterdayMap.get(key)));
        Logger.log('first diff today: ' + JSON.stringify(todayRow));
        loggedFirst = true;
      }
      differences.push(todayRow);
    }
  }

  // 削除
  for (const [key, yesterdayRow] of yesterdayMap.entries()) {
    if (!todayMap.has(key)) {
      const delRow = yesterdayRow.slice();
      delRow.push('DELETE');
      differences.push(delRow);
    }
  }

  Logger.log('differences: ' + differences.length);

  if (differences.length > 0) {
    const headers = yesterdayData[0];
    const month = parseInt(monthPrefix.match(/(\d+)月/)[1], 10);
    const sheetName = `Diff_${month}月`;
    const existing = ss.getSheetByName(sheetName);
    if (existing) ss.deleteSheet(existing);
    const newDiffSheet = ss.insertSheet(sheetName);
    newDiffSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    newDiffSheet.getRange(2, 1, differences.length, differences[0].length).setValues(differences);
  }

  return differences;
}

/** 以降、ユーザー配信・イベント生成ロジックは提供頂いた既存関数をそのまま配置 */
function processAllUsers(diffData) {
  if (!diffData || diffData.length === 0) {
    Logger.log('処理対象のデータがありません');
    return;
  }

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

  usersMap.forEach((user) => {
    Logger.log('処理開始: ' + user.name + ' (' + user.email + ')');
    addEventsFromSpreadsheet(user, diffData);
  });
}

/** 以下 addEventsFromSpreadsheet / validate* / generateEventTitle / process* は既存どおり */
function addEventsFromSpreadsheet(user, diffData) {
  if (!validateInputs(user)) return;

  const calendar = CalendarApp.getCalendarById(user.email);
  if (!calendar) {
    Logger.log('指定のカレンダーが見つかりません: ' + user.email);
    return;
  }

  const filteredData = diffData.filter(
    (row) => String(row[0]).trim() === user.name
  );
  if (filteredData.length === 0) {
    Logger.log(`${user.name}の処理対象データが0件のため、処理を終了します。`);
    return;
  }

  filteredData.forEach((row, index) => {
    const rowNum = index + 1;

    const eventDetails = validateEventData(row, rowNum);
    if (!eventDetails) return;

    const { eventDate, scheduleTemplateId, startTimeStr, endTimeStr } = eventDetails;

    const title = generateEventTitle(
      scheduleTemplateId,
      startTimeStr,
      endTimeStr
    );

    const leaveType = String(row[8]).trim();
    if (leaveType === '年次有給' || leaveType === 'リフレッシュ休暇') {
      processFullDayEvent(calendar, eventDate, leaveType, rowNum);
      const leaveStart = new Date(eventDate); leaveStart.setHours(9, 0, 0, 0);
      const leaveEnd   = new Date(eventDate); leaveEnd.setHours(21, 0, 0, 0);
      const events = calendar.getEvents(leaveStart, leaveEnd, { search: '業務時間外' });
      if (events.length === 0) {
        calendar.createEvent('業務時間外', leaveStart, leaveEnd, { reminders: { useDefault: false, overrides: [] } });
        Logger.log(`行 ${rowNum}：${leaveType}の業務時間外イベント作成（9:00～21:00）`);
      } else {
        events.forEach((event) => {
          if (event.getTitle() === '業務時間外' &&
              (event.getStartTime().getTime() !== leaveStart.getTime() ||
               event.getEndTime().getTime()   !== leaveEnd.getTime())) {
            event.setTime(leaveStart, leaveEnd);
            Logger.log(`行 ${rowNum}：${leaveType}の業務時間外イベント更新（9:00～21:00）`);
          }
        });
      }
      return;
    }

    processFullDayEvent(calendar, eventDate, title, rowNum);

    if (scheduleTemplateId === '0') {
      const holidayStart = new Date(eventDate); holidayStart.setHours(9, 0, 0, 0);
      const holidayEnd   = new Date(eventDate); holidayEnd.setHours(21, 0, 0, 0);
      const events = calendar.getEvents(holidayStart, holidayEnd, { search: '業務時間外' });
      if (events.length === 0) {
        calendar.createEvent('業務時間外', holidayStart, holidayEnd, { reminders: { useDefault: false, overrides: [] } });
        Logger.log(`行 ${rowNum}：公休の業務時間外イベント作成（9:00～21:00）`);
      } else {
        events.forEach((event) => {
          if (event.getTitle() === '業務時間外' &&
              (event.getStartTime().getTime() !== holidayStart.getTime() ||
               event.getEndTime().getTime()   !== holidayEnd.getTime())) {
            event.setTime(holidayStart, holidayEnd);
            Logger.log(`行 ${rowNum}：公休の業務時間外イベント更新（9:00～21:00）`);
          }
        });
      }
    } else {
      processWorkingHoursEvents(calendar, eventDate, startTimeStr, endTimeStr, rowNum);
    }
  });
}

function validateInputs(user) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');

  if (!user || !spreadsheetId) {
    Logger.log('必要なプロパティが設定されていません。');
    return false;
  }
  return true;
}

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
    Logger.log(`行 ${rowNum}：出勤予定時刻または退勤予定時刻が空のためスキップ`);
    return null;
  }

  if (startTimeStr instanceof Date) {
    startTimeStr = Utilities.formatDate(startTimeStr, Session.getScriptTimeZone(), 'HH:mm');
  }
  if (endTimeStr instanceof Date) {
    endTimeStr = Utilities.formatDate(endTimeStr, Session.getScriptTimeZone(), 'HH:mm');
  }

  return { eventDate, scheduleTemplateId, startTimeStr, endTimeStr };
}

function generateEventTitle(scheduleTemplateId, startTimeStr, endTimeStr) {
  if (scheduleTemplateId === '0') return '公休';
  const startDecimal = convertTimeStringToDecimal(startTimeStr);
  const endDecimal = convertTimeStringToDecimal(endTimeStr);
  return `${startDecimal}-${endDecimal}`;
}

function processFullDayEvent(calendar, eventDate, title, rowNum) {
  const existingFullDay = calendar.getEventsForDay(eventDate).filter((event) => event.isAllDayEvent());

  if (existingFullDay.length === 0) {
    calendar.createAllDayEvent(title, eventDate, { reminders: { useDefault: false, overrides: [] } });
    Logger.log(`行 ${rowNum}：終日イベント作成: ${eventDate.toDateString()} / タイトル: ${title}`);
    return;
  }

  const regex = /^(公休|\d+(\.\d+)?-\d+(\.\d+)?)$/;
  let updated = false;

  existingFullDay.forEach((event) => {
    const currentTitle = event.getTitle();
    if (regex.test(currentTitle) && currentTitle !== title) {
      event.setTitle(title);
      Logger.log(`行 ${rowNum}：既存イベントのタイトルを更新しました: ${title}`);
      updated = true;
    }
  });

  if (!updated) {
    Logger.log(`行 ${rowNum}：既存の終日イベントは更新不要です`);
  }
}

function processWorkingHoursEvents(calendar, eventDate, startTimeStr, endTimeStr, rowNum) {
  const times = calculateWorkingTimes(eventDate, startTimeStr, endTimeStr);

  processPeriodEvent(calendar, times.dayStart,        times.workingStartTime, rowNum, '午前');
  processPeriodEvent(calendar, times.workingEndTime,  times.dayEnd,           rowNum, '午後');
}

function calculateWorkingTimes(eventDate, startTimeStr, endTimeStr) {
  const startParts = String(startTimeStr).split(':');
  const endParts   = String(endTimeStr).split(':');

  let dayStart = new Date(eventDate); dayStart.setHours(0, 0, 0, 0);
  let dayEnd   = new Date(eventDate); dayEnd.setHours(24, 0, 0, 0);

  let workingStartTime = new Date(eventDate);
  workingStartTime.setHours(parseInt(startParts[0], 10), parseInt(startParts[1], 10), 0, 0);

  let workingEndTime = new Date(eventDate);
  workingEndTime.setHours(parseInt(endParts[0], 10), parseInt(endParts[1], 10), 0, 0);

  return { dayStart, dayEnd, workingStartTime, workingEndTime };
}

function processPeriodEvent(calendar, startTime, endTime, rowNum, period) {
  const events = calendar.getEvents(startTime, endTime, { search: '業務時間外' });
  const timeStr =
    period === '午前'
      ? `0～${Utilities.formatDate(endTime, Session.getScriptTimeZone(), 'HH:mm')}`
      : `${Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm')}～24:00`;

  if (events.length === 0) {
    calendar.createEvent('業務時間外', startTime, endTime, { reminders: { useDefault: false, overrides: [] } });
    Logger.log(`行 ${rowNum}：${period}の業務時間外イベント作成（${timeStr}）`);
    return;
  }

  const regex = /^業務時間外$/;
  let updated = false;

  events.forEach((event) => {
    if (regex.test(event.getTitle())) {
      const currentStart = event.getStartTime();
      const currentEnd   = event.getEndTime();

      if (currentStart.getTime() !== startTime.getTime() || currentEnd.getTime() !== endTime.getTime()) {
        event.setTime(startTime, endTime);
        Logger.log(`行 ${rowNum}：${period}の業務時間外イベント更新（新: ${timeStr}）`);
        updated = true;
      }
    }
  });

  if (!updated) {
    Logger.log(`行 ${rowNum}：${period}の業務時間外イベントは既に最新の状態です`);
  }
}

function convertTimeStringToDecimal(timeStr) {
  if (timeStr instanceof Date) {
    timeStr = Utilities.formatDate(timeStr, Session.getScriptTimeZone(), 'HH:mm');
  }
  const parts = String(timeStr).split(':');
  if (parts.length !== 2) return String(timeStr);

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (minutes === 0) return hours.toString();
  if (minutes === 30) return hours + '.5';
  return (hours + minutes / 60).toFixed(2);
}

/** ==== 参考: シート列削除ユーティリティ（非推奨・使わない想定。互換のため残置） ==== */
function cleanupActiveSheetColumnsAHandCH() {
  const ss = getSpreadsheet();
  const sheet = ss.getActiveSheet ? ss.getActiveSheet() : ss.getSheets()[0];
  keepAHAndCHColumnsInSheet(sheet);
}
function keepAHAndCHColumnsInSheet(sheet) {
  if (!sheet) return;
  let last = sheet.getLastColumn();
  if (last <= 8) return;
  if (last > 86) {
    const count = last - 86;
    sheet.deleteColumns(87, count);
  }
  last = sheet.getLastColumn();
  const rightEnd = Math.min(85, last);
  if (rightEnd >= 9) {
    const count2 = rightEnd - 8;
    sheet.deleteColumns(9, count2);
  }
}

/** onOpen: メニュー（任意） */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('整形ツール')
    .addItem('A〜HとCHのみ残す（非推奨: 手動）', 'cleanupActiveSheetColumnsAHandCH')
    .addToUi();
}
