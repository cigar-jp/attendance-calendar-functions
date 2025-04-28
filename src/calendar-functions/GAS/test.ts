// @ts-nocheck
/**
 * 簡易アサート関数
 */
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message + ' expected: ' + expected + ', got: ' + actual);
  }
}
function assertArrayEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(message + ' expected: ' + e + ', got: ' + a);
  }
}

/**
 * テスト実行
 */
function runAllTests() {
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
function test_getDataMonths() {
  const csv = 'h1,h2,h3\nA,1,2025/04/01\nB,2,2025/05/15\nC,3,2025/04/20';
  const months = getDataMonths(csv);
  assertArrayEqual(months, [4, 5], 'getDataMonths()');
}

/**
 * filterDataByMonth のテスト
 */
function test_filterDataByMonth() {
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
function test_getMonthPrefix() {
  assertEqual(getMonthPrefix(3), '3月_', 'getMonthPrefix()');
}

/**
 * formatCsvData のテスト
 */
function test_formatCsvData() {
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
function test_calculateWorkingTimes() {
  const date = new Date('2025-04-01');
  const times = calculateWorkingTimes(date, '09:00', '17:30');
  assertEqual(times.dayStart.getHours(), 0, 'dayStart');
  assertEqual(times.workingStartTime.getHours(), 9, 'workingStartTime hour');
  assertEqual(times.workingEndTime.getHours(), 17, 'workingEndTime hour');
}

/**
 * convertTimeStringToDecimal のテスト
 */
function test_convertTimeStringToDecimal() {
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

// テスト実行
runAllTests();
