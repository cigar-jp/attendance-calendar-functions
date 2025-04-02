import { describe, it, expect } from 'vitest';

/**
 * CSVパース用のユーティリティ関数
 */
function parseCsv(csvContent: string): string[][] {
  return csvContent.split('\n').map((line) => line.split(','));
}

/**
 * テストデータの作成
 */
function createTestData() {
  return {
    currentMonth: {
      csv: `氏名,従業員番号,日付,曜日,シフトグループ,スケジュールテンプレートID,出勤予定時刻,退勤予定時刻
福田 真一,1001,2025/04/15,火,グループA,1,09:00,18:00
塩田 敬子,1002,2025/04/15,火,グループB,1,10:00,19:00`,
      expected: [
        [
          '福田 真一',
          '1001',
          '2025/04/15',
          '火',
          'グループA',
          '1',
          '09:00',
          '18:00',
        ],
        [
          '塩田 敬子',
          '1002',
          '2025/04/15',
          '火',
          'グループB',
          '1',
          '10:00',
          '19:00',
        ],
      ],
    },
    nextMonth: {
      csv: `氏名,従業員番号,日付,曜日,シフトグループ,スケジュールテンプレートID,出勤予定時刻,退勤予定時刻
福田 真一,1001,2025/05/15,木,グループA,1,09:00,18:00
塩田 敬子,1002,2025/05/15,木,グループB,1,10:00,19:00`,
      expected: [
        [
          '福田 真一',
          '1001',
          '2025/05/15',
          '木',
          'グループA',
          '1',
          '09:00',
          '18:00',
        ],
        [
          '塩田 敬子',
          '1002',
          '2025/05/15',
          '木',
          'グループB',
          '1',
          '10:00',
          '19:00',
        ],
      ],
    },
  };
}

describe('カレンダー機能のテスト', () => {
  describe('月判定のテスト', () => {
    function testIsNextMonth(csvContent: string): boolean {
      const rows = parseCsv(csvContent);
      if (rows.length < 2) return false; // ヘッダーのみの場合

      const firstDataRow = rows[1]; // ヘッダー行を除いた最初の行
      const dateStr = firstDataRow[2]; // 日付列
      const today = new Date();
      const dataDate = new Date(dateStr);

      return dataDate.getMonth() !== today.getMonth();
    }

    const testData = createTestData();

    it('今月のデータを正しく判定できる', () => {
      const result = testIsNextMonth(testData.currentMonth.csv);
      expect(result).toBe(false);
    });

    it('来月のデータを正しく判定できる', () => {
      const result = testIsNextMonth(testData.nextMonth.csv);
      expect(result).toBe(true);
    });
  });

  describe('シート名生成のテスト', () => {
    const testCases = [
      { month: 4, type: '今日分', expected: '4月_今日分' },
      { month: 4, type: '昨日分', expected: '4月_昨日分' },
      { month: 5, type: '今日分', expected: '5月_今日分' },
      { month: 5, type: '昨日分', expected: '5月_昨日分' },
      { month: 12, type: '今日分', expected: '12月_今日分' },
    ];

    testCases.forEach(({ month, type, expected }) => {
      it(`${expected}のシート名を正しく生成できる`, () => {
        const sheetName = (month: number, type: string) => `${month}月_${type}`;
        const result = sheetName(month, type);
        expect(result).toBe(expected);
      });
    });
  });

  describe('シート名から月の抽出テスト', () => {
    const testCases = [
      { sheetName: '4月_今日分', expected: 4 },
      { sheetName: '5月_昨日分', expected: 5 },
      { sheetName: '12月_今日分', expected: 12 },
    ];

    testCases.forEach(({ sheetName, expected }) => {
      it(`${sheetName}から月を正しく抽出できる`, () => {
        const matches = sheetName.match(/(\d+)月/);
        if (!matches) {
          throw new Error(`シート名から月を抽出できません: ${sheetName}`);
        }
        const month = parseInt(matches[1]);
        expect(month).toBe(expected);
      });

      it(`不正なシート名でエラーが発生する`, () => {
        const invalidSheetName = 'invalid_sheet_name';
        expect(() => {
          const matches = invalidSheetName.match(/(\d+)月/);
          if (!matches) {
            throw new Error(
              `シート名から月を抽出できません: ${invalidSheetName}`,
            );
          }
          return parseInt(matches[1]);
        }).toThrow('シート名から月を抽出できません');
      });
    });
  });

  describe('差分抽出のテスト', () => {
    const yesterday = [
      [
        '氏名',
        '従業員番号',
        '日付',
        '曜日',
        'グループ',
        'テンプレートID',
        '出勤',
        '退勤',
      ],
      ['福田 真一', '1001', '2025/04/15', '火', 'A', '1', '09:00', '18:00'],
      ['塩田 敬子', '1002', '2025/04/15', '火', 'B', '1', '10:00', '19:00'],
    ];

    const today = [
      [
        '氏名',
        '従業員番号',
        '日付',
        '曜日',
        'グループ',
        'テンプレートID',
        '出勤',
        '退勤',
      ],
      ['福田 真一', '1001', '2025/04/15', '火', 'A', '1', '09:30', '18:00'], // 変更
      ['塩田 敬子', '1002', '2025/04/15', '火', 'B', '1', '10:00', '19:00'], // 変更なし
      ['坪井 彩華', '1003', '2025/04/15', '火', 'A', '1', '09:00', '18:00'], // 新規
    ];

    function extractDifferences(
      yesterdayData: string[][],
      todayData: string[][],
    ): string[][] {
      const differences: string[][] = [];

      // 今日のデータを処理
      for (let i = 1; i < todayData.length; i++) {
        const todayRow = todayData[i];
        const key = `${todayRow[0]}_${todayRow[2]}`; // 名前と日付の組み合わせ

        const yesterdayRow = yesterdayData.find(
          (row, index) => index > 0 && `${row[0]}_${row[2]}` === key,
        );

        if (
          !yesterdayRow ||
          yesterdayRow[5] !== todayRow[5] || // テンプレートID
          yesterdayRow[6] !== todayRow[6] || // 出勤時刻
          yesterdayRow[7] !== todayRow[7] // 退勤時刻
        ) {
          differences.push(todayRow);
        }
      }

      return differences;
    }

    it('差分を正しく検出できる', () => {
      const differences = extractDifferences(yesterday, today);
      expect(differences).toHaveLength(2); // 変更1件 + 新規1件
      expect(differences[0][6]).toBe('09:30'); // 変更された出勤時刻
      expect(differences[1][0]).toBe('坪井 彩華'); // 新規追加された従業員
    });
  });
});
