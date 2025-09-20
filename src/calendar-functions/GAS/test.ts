/**
 * 簡易アサート関数
 */
function assertEqual(actual: any, expected: any, message: string): void {
  if (actual !== expected) {
    throw new Error(message + ' expected: ' + expected + ', got: ' + actual);
  }
}
function assertArrayEqual(
  actual: any[],
  expected: any[],
  message: string
): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(message + ' expected: ' + e + ', got: ' + a);
  }
}

declare const Logger: { log(message: string): void };
declare function getDataMonths(csv: string): number[];
declare function filterDataByMonth(rows: any[][], month: number): any[];
declare function getMonthPrefix(month: number): string;
declare function formatCsvData(csv: string): any[][];
// 新規ユーティリティ
declare function keepAHAndCHColumns(rows: any[][]): any[][];
declare function formatCsvDataKeepAHAndCH(csv: string): any[][];
declare function calculateWorkingTimes(
  eventDate: Date,
  startTimeStr: string,
  endTimeStr: string
): { dayStart: Date; workingStartTime: Date; workingEndTime: Date };
declare function convertTimeStringToDecimal(timeStr: string): string;

/**
 * テスト実行
 */
function runAllTests(): void {
  test_getDataMonths();
  test_filterDataByMonth();
  test_getMonthPrefix();
  test_formatCsvData();
  test_keepAHAndCHColumns();
  test_formatCsvDataKeepAHAndCH();
  test_calculateWorkingTimes();
  test_convertTimeStringToDecimal();
  Logger.log('すべてのテストが成功しました');
}

/**
 * getDataMonths のテスト
 */
function test_getDataMonths(): void {
  const csv = 'h1,h2,h3\nA,1,2025/04/01\nB,2,2025/05/15\nC,3,2025/04/20';
  const months = getDataMonths(csv);
  assertArrayEqual(months, [4, 5], 'getDataMonths()');
}

/**
 * filterDataByMonth のテスト
 */
function test_filterDataByMonth(): void {
  const rows = [
    ['A', '1', '2025/04/01', '', '', '', '09:00', '18:00'],
    ['B', '2', '2025/05/02', '', '', '', '10:00', '19:00'],
  ];
  const f4 = filterDataByMonth(rows, 4);
  assertArrayEqual(f4, [rows[0]], 'filterDataByMonth() month=4');
}

/**
 * getMonthPrefix のテスト
 */
function test_getMonthPrefix(): void {
  assertEqual(getMonthPrefix(3), '3月_', 'getMonthPrefix()');
}

/**
 * formatCsvData のテスト
 */
function test_formatCsvData(): void {
  const csv =
    'h1,h2,h3,h4,h5,h6,h7,h8,h9\n' +
    'A,1,2025/04/01,g1,gName,0,09:00,18:00,extra';
  const formatted = formatCsvData(csv);
  assertArrayEqual(
    formatted,
    [['A', '1', '2025/04/01', 'g1', 'gName', '0', '09:00', '18:00']],
    'formatCsvData()'
  );
}

/**
 * keepAHAndCHColumns のテスト
 */
function test_keepAHAndCHColumns(): void {
  // 3行: 1行目はヘッダ、2行目はCH列あり、3行目はCH列なし
  const rowWithCH: any[] = [];
  for (let i = 0; i < 90; i++) rowWithCH.push('c' + i);
  // A..H は c0..c7, CH は c85
  const rows = [
    ['A','B','C','D','E','F','G','H','I','J'],
    rowWithCH,
    ['a0','a1','a2','a3','a4','a5','a6','a7'],
  ];
  const kept = keepAHAndCHColumns(rows);
  assertArrayEqual(
    kept[0],
    ['A','B','C','D','E','F','G','H'],
    'keepAHAndCHColumns row0'
  );
  assertEqual(kept[0].length, 8, 'row0 length');
  assertArrayEqual(
    kept[1].slice(0, 9),
    ['c0','c1','c2','c3','c4','c5','c6','c7','c85'],
    'keepAHAndCHColumns row1 with CH'
  );
  assertEqual(kept[1].length, 9, 'row1 length');
  assertArrayEqual(
    kept[2],
    ['a0','a1','a2','a3','a4','a5','a6','a7'],
    'keepAHAndCHColumns row2 no CH'
  );
}

/**
 * formatCsvDataKeepAHAndCH のテスト
 */
function test_formatCsvDataKeepAHAndCH(): void {
  // 86列以上のCSVを構築（0..89）
  const header = Array.from({ length: 90 }, (_, i) => 'h' + i).join(',');
  const row = Array.from({ length: 90 }, (_, i) => 'v' + i).join(',');
  const csv = header + '\n' + row;
  const out = formatCsvDataKeepAHAndCH(csv);
  // 期待: A..H(h0..h7) + CH(h85) が残る => 9列
  assertEqual(out[0].length, 9, 'header length');
  assertArrayEqual(out[0].slice(0, 9), ['h0','h1','h2','h3','h4','h5','h6','h7','h85'], 'header cols');
  assertEqual(out[1].length, 9, 'row length');
  assertArrayEqual(out[1].slice(0, 9), ['v0','v1','v2','v3','v4','v5','v6','v7','v85'], 'row cols');
}

/**
 * calculateWorkingTimes のテスト
 */
function test_calculateWorkingTimes(): void {
  const date = new Date('2025-04-01');
  const times = calculateWorkingTimes(date, '09:00', '17:30');
  assertEqual(times.dayStart.getHours(), 0, 'dayStart');
  assertEqual(times.workingStartTime.getHours(), 9, 'workingStartTime hour');
  assertEqual(times.workingEndTime.getHours(), 17, 'workingEndTime hour');
}

/**
 * convertTimeStringToDecimal のテスト
 */
function test_convertTimeStringToDecimal(): void {
  assertEqual(
    convertTimeStringToDecimal('9:00'),
    '9',
    'convertTimeStringToDecimal 9:00'
  );
  assertEqual(
    convertTimeStringToDecimal('20:30'),
    '20.5',
    'convertTimeStringToDecimal 20:30'
  );
  assertEqual(
    convertTimeStringToDecimal('08:15'),
    '8.25',
    'convertTimeStringToDecimal 08:15'
  );
}

declare function extractDifferencesFromArrays(
  yesterdayData: any[][],
  todayData: any[][]
): any[][];
/**
 * extractDifferencesFromArrays のテスト（追加・変更）
 */
function test_extractDifferences_change_and_add(): void {
  const header = ['名', '', '2025-04-01', '', '', '0', '09:00', '10:00'];
  const yesterday = [
    header,
    ['A', '', '2025-04-01', '', '', '0', '09:00', '18:00'],
    ['B', '', '2025-04-01', '', '', '1', '10:00', '19:00'],
  ];
  const today = [
    header,
    ['A', '', '2025-04-01', '', '', '0', '09:00', '18:00'],
    ['B', '', '2025-04-01', '', '', '1', '11:00', '20:00'],
    ['C', '', '2025-04-01', '', '', '2', '09:30', '18:30'],
  ];
  const diffs = extractDifferencesFromArrays(yesterday, today);
  const names = diffs.map((r) => r[0]);
  assertArrayEqual(names, ['B', 'C'], 'extractDifferences add/change');
}
/**
 * extractDifferencesFromArrays のテスト（削除）
 */
function test_extractDifferences_delete(): void {
  const header = ['名', '', '2025-04-01', '', '', '0', '09:00', '10:00'];
  const yesterday = [
    header,
    ['X', '', '2025-04-01', '', '', '0', '09:00', '18:00'],
    ['Y', '', '2025-04-01', '', '', '1', '10:00', '19:00'],
  ];
  const today = [
    header,
    ['X', '', '2025-04-01', '', '', '0', '09:00', '18:00'],
  ];
  const diffs = extractDifferencesFromArrays(yesterday, today);
  const deleted = diffs.find((r) => r[0] === 'Y' && r[8] === 'DELETE');
  assertEqual(deleted![8], 'DELETE', 'extractDifferences delete');
}
// テスト実行
runAllTests();
