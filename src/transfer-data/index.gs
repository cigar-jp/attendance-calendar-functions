// スプレッドシートの転記スクリプト
const SOURCE_SHEET_ID = '1SLUhE_ZMSmmMlmfSnYAoVHIKx_OSV2bN83UqV71-oi4';
const DEST_SHEET_IDS = {
  2024: '1up4-yDowiwiLtxQTwHv5dk2s71ll39BVbqa4ARygmGs',
  2025: '1KrnlgyLUA_ldlOl50_x_5mE6h_6FbU5ze_Th7pvJn7I',
};

/**
 * 編集時トリガー: 編集された行のみを転記
 */
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getParent().getId() !== SOURCE_SHEET_ID) return;
  const rowIndex = e.range.getRow();
  if (rowIndex === 1) return; // ヘッダー行をスキップ

  const row = sheet
    .getRange(rowIndex, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  const columnA = row[0];
  const columnAB = row[27];
  if (!columnA || columnAB === '済') return;

  processRow(row, rowIndex, sheet);
}

/**
 * 単一行の転記処理を共通化
 */
function processRow(row, rowIndex, sourceSheet) {
  const columnA = row[0];
  const columnC = row[2];
  const executionDate = new Date(columnA);
  const year = executionDate.getFullYear();
  const month = executionDate.getMonth() + 1;

  let targetSheetId;
  if (year === 2024 || (year === 2025 && month <= 8)) {
    targetSheetId = DEST_SHEET_IDS[2024];
  } else if (year === 2025 || (year === 2026 && month <= 8)) {
    targetSheetId = DEST_SHEET_IDS[2025];
  } else {
    return;
  }

  const targetSS = SpreadsheetApp.openById(targetSheetId);
  const targetSheet = targetSS.getSheetByName(`${month}月`);
  if (!targetSheet) return;

  const data = targetSheet.getDataRange().getValues();
  let writeRow = -1;
  data.forEach((r, i) => {
    if (r[0] === columnC) {
      for (let j = i + 1; j < data.length; j++) {
        if (!data[j][0]) {
          writeRow = j;
          break;
        }
      }
    }
  });
  if (writeRow === -1) writeRow = data.length;

  // C列は空に、それ以外をコピー
  const newRow = row.map((v, i) => (i === 2 ? '' : v));
  targetSheet.insertRowAfter(writeRow);
  targetSheet.getRange(writeRow + 1, 1, 1, newRow.length).setValues([newRow]);

  // 日付でソート
  const start = data.findIndex((r) => r[0] === columnC) + 1;
  const end = writeRow + 1;
  targetSheet
    .getRange(start + 1, 1, end - start, data[0].length)
    .sort({ column: 1, ascending: true });

  // 元シートAB列を「済」に更新
  sourceSheet.getRange(rowIndex, 28).setValue('済');
}

/**
 * 定期実行用: 全行を走査
 */
function transferData() {
  const ss = SpreadsheetApp.openById(SOURCE_SHEET_ID);
  const sheet = ss.getActiveSheet();
  const rows = sheet.getDataRange().getValues();

  Logger.log('データ転記処理を開始します');
  rows.forEach((row, i) => {
    if (i === 0) return;
    if (!row[0] || row[27] === '済') return;
    Logger.log(`行 ${i + 1} を処理`);
    processRow(row, i + 1, sheet);
    Logger.log(`行 ${i + 1} 完了`);
  });
  Logger.log('データ転記処理が完了しました');
}

function testProcessRow() {
  const sheet = SpreadsheetApp.openById(SOURCE_SHEET_ID).getActiveSheet();
  const testRowIndex = 2; // テスト用の行番号
  const row = sheet
    .getRange(testRowIndex, 1, 1, sheet.getLastColumn())
    .getValues()[0];
  processRow(row, testRowIndex, sheet);
}

function testOnEdit() {
  const sheet = SpreadsheetApp.openById(SOURCE_SHEET_ID).getActiveSheet();
  const range = sheet.getRange(2, 1); // テスト用のセル
  onEdit({ range });
}
