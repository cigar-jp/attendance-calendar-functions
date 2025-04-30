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
