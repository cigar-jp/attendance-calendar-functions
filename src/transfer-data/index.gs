// スプレッドシートの転記スクリプト
function transferData() {
  const sourceSheetId = '1SLUhE_ZMSmmMlmfSnYAoVHIKx_OSV2bN83UqV71-oi4'; // 転記元スプレッドシートID
  const destSheetIds = {
    2024: '1up4-yDowiwiLtxQTwHv5dk2s71ll39BVbqa4ARygmGs',
    2025: '1KrnlgyLUA_ldlOl50_x_5mE6h_6FbU5ze_Th7pvJn7I',
  };
  const sourceSpreadsheet = SpreadsheetApp.openById(sourceSheetId);
  const sourceSheet = sourceSpreadsheet.getActiveSheet();
  const sourceData = sourceSheet.getDataRange().getValues();

  Logger.log('データ転記処理を開始します');

  sourceData.forEach((row, rowIndex) => {
    if (rowIndex === 0) return; // ヘッダー行をスキップ

    Logger.log(`現在、${rowIndex + 1} 行目を処理しています`);

    const columnA = row[0]; // 施行日
    const columnAB = row[27]; // 状況
    const columnC = row[2]; // 成約場所

    if (!columnA || columnAB === '済') {
      Logger.log(
        `${rowIndex + 1} 行目をスキップしました（施行日が空または状況が済）`,
      );
      return; // 空白や"済"の場合はスキップ
    }

    const executionDate = new Date(columnA);
    const executionYear = executionDate.getFullYear();
    const executionMonth = executionDate.getMonth() + 1; // 月は0から始まるため+1

    Logger.log(
      `施行日: ${executionDate}、年: ${executionYear}、月: ${executionMonth}`,
    );

    let targetSheetId;
    if (
      executionYear === 2024 ||
      (executionYear === 2025 && executionMonth <= 8)
    ) {
      targetSheetId = destSheetIds['2024'];
    } else if (
      executionYear === 2025 ||
      (executionYear === 2026 && executionMonth <= 8)
    ) {
      targetSheetId = destSheetIds['2025'];
    } else {
      Logger.log(`${rowIndex + 1} 行目は対象期間外です`);
      return; // 対象外の期間
    }

    const targetSpreadsheet = SpreadsheetApp.openById(targetSheetId);
    const targetSheet = targetSpreadsheet.getSheetByName(`${executionMonth}月`);

    if (!targetSheet) {
      Logger.log(`対象のシート (${executionMonth}月) が見つかりませんでした`);
      return; // 対象シートが存在しない場合はスキップ
    }

    Logger.log(`対象のシート (${executionMonth}月) が見つかりました`);

    const targetData = targetSheet.getDataRange().getValues();

    let writeRowIndex = -1;
    targetData.forEach((targetRow, targetRowIndex) => {
      if (targetRow[0] === columnC) {
        for (let i = targetRowIndex + 1; i < targetData.length; i++) {
          if (!targetData[i][0]) {
            writeRowIndex = i;
            break;
          }
        }
      }
    });

    if (writeRowIndex === -1) {
      writeRowIndex = targetData.length; // 末尾に追加
    }

    Logger.log(`対象シートの ${writeRowIndex + 1} 行目にデータを書き込みます`);

    // C列の値をスキップしつつ、他の列をそのままコピー
    const newRow = row.map((value, index) => (index === 2 ? '' : value));

    targetSheet.insertRowAfter(writeRowIndex);
    targetSheet
      .getRange(writeRowIndex + 1, 1, 1, newRow.length)
      .setValues([newRow]);

    // A列で日付ソート
    const startSortRow = targetData.findIndex((row) => row[0] === columnC) + 1;
    const endSortRow = writeRowIndex + 1;
    const sortRange = targetSheet.getRange(
      startSortRow + 1,
      1,
      endSortRow - startSortRow,
      targetData[0].length,
    );

    sortRange.sort({ column: 1, ascending: true });

    // 転記元のAB列に「済」を記載
    sourceSheet.getRange(rowIndex + 1, 2, 1, 1).setValue('済');

    Logger.log(
      `${rowIndex + 1} 行目の処理が完了しました。「済」に更新しました`,
    );
  });

  Logger.log('データ転記処理が完了しました');
}
