import { google, sheets_v4 } from 'googleapis';
import { createLogger } from './logger';
import { SHEET_CONSTANTS } from './config';
import { CsvRow, DiffData, SpreadsheetOperationResult } from './types';

const logger = createLogger('SpreadsheetHandler');

/**
 * スプレッドシート処理を管理するクラス
 */
export class SpreadsheetHandler {
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor(auth: any, spreadsheetId: string) {
    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = spreadsheetId;
  }

  /**
   * シートの更新処理
   */
  public async updateSheets(
    monthData: CsvRow[],
    monthPrefix: string
  ): Promise<SpreadsheetOperationResult> {
    try {
      logger.logStart('updateSheets', {
        monthPrefix,
        rowCount: monthData.length,
      });

      // シート名を生成
      const todaySheetName = monthPrefix + SHEET_CONSTANTS.TODAY_SUFFIX;
      const yesterdaySheetName = monthPrefix + SHEET_CONSTANTS.YESTERDAY_SUFFIX;

      // 既存のシートを取得
      const existingSheets = await this.listSheets();
      const todaySheet = existingSheets.find(
        (sheet) => sheet.properties?.title === todaySheetName
      );
      const yesterdaySheet = existingSheets.find(
        (sheet) => sheet.properties?.title === yesterdaySheetName
      );

      // シートの更新処理
      if (todaySheet) {
        // 今日分を昨日分にコピー
        if (yesterdaySheet) {
          await this.deleteSheet(yesterdaySheet.properties!.sheetId!);
        }
        const newYesterdaySheet = await this.copySheet(
          todaySheet.properties!.sheetId!,
          yesterdaySheetName
        );
        logger.info('昨日分のシートを更新しました', {
          sheetId: newYesterdaySheet.properties?.sheetId,
        });

        // 既存の今日分を削除
        await this.deleteSheet(todaySheet.properties!.sheetId!);
      }

      // 新しいデータを今日分として保存
      const newTodaySheet = await this.createSheet(todaySheetName);
      await this.writeData(newTodaySheet.properties!.sheetId!, monthData);
      logger.info('今日分のシートを更新しました', {
        sheetId: newTodaySheet.properties?.sheetId,
      });

      logger.logComplete('updateSheets');
      return {
        success: true,
        message: 'シートの更新が完了しました',
      };
    } catch (error) {
      logger.logFailure('updateSheets', error as Error);
      return {
        success: false,
        message: '処理に失敗しました',
        error: {
          timestamp: new Date().toISOString(),
          errorCode: 'SHEET_UPDATE_ERROR',
          message: error instanceof Error ? error.message : '不明なエラー',
          stackTrace: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  /**
   * 差分を抽出
   */
  public async extractDifferences(
    monthPrefix: string
  ): Promise<SpreadsheetOperationResult> {
    try {
      logger.logStart('extractDifferences', { monthPrefix });

      // シート名を生成
      const todaySheetName = monthPrefix + SHEET_CONSTANTS.TODAY_SUFFIX;
      const yesterdaySheetName = monthPrefix + SHEET_CONSTANTS.YESTERDAY_SUFFIX;

      // 既存のシートを取得
      const existingSheets = await this.listSheets();
      const todaySheet = existingSheets.find(
        (sheet) => sheet.properties?.title === todaySheetName
      );
      const yesterdaySheet = existingSheets.find(
        (sheet) => sheet.properties?.title === yesterdaySheetName
      );

      if (!yesterdaySheet || !todaySheet) {
        const error = {
          timestamp: new Date().toISOString(),
          errorCode: 'SHEET_NOT_FOUND',
          message: '必要なシートが見つかりません',
          details: {
            monthPrefix,
            hasYesterday: !!yesterdaySheet,
            hasToday: !!todaySheet,
          },
        };
        logger.error(
          'シートが見つかりません',
          new Error(`シートが見つかりません: ${JSON.stringify(error)}`)
        );
        return { success: false, message: error.message, error };
      }

      // データを取得
      const yesterdayData = await this.readData(
        yesterdaySheet.properties!.sheetId!
      );
      const todayData = await this.readData(todaySheet.properties!.sheetId!);

      // 差分を抽出
      const differences = this.findDifferences(yesterdayData, todayData);

      logger.logComplete('extractDifferences', {
        diffCount: differences.length,
      });
      return {
        success: true,
        message: '差分抽出が完了しました',
        data: differences,
      };
    } catch (error) {
      logger.logFailure('extractDifferences', error as Error);
      return {
        success: false,
        message: '処理に失敗しました',
        error: {
          timestamp: new Date().toISOString(),
          errorCode: 'DIFF_EXTRACT_ERROR',
          message: error instanceof Error ? error.message : '不明なエラー',
          stackTrace: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  /**
   * シートの一覧を取得
   */
  private async listSheets(): Promise<sheets_v4.Schema$Sheet[]> {
    const response = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });
    return response.data.sheets || [];
  }

  /**
   * シートを作成
   */
  private async createSheet(title: string): Promise<sheets_v4.Schema$Sheet> {
    const response = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title,
              },
            },
          },
        ],
      },
    });

    const addedSheet = response.data.replies?.[0].addSheet;
    if (!addedSheet) {
      throw new Error('シートの作成に失敗しました');
    }

    return { properties: addedSheet.properties };
  }

  /**
   * シートを削除
   */
  private async deleteSheet(sheetId: number): Promise<void> {
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId,
            },
          },
        ],
      },
    });
  }

  /**
   * シートをコピー
   */
  private async copySheet(
    sourceSheetId: number,
    destinationTitle: string
  ): Promise<sheets_v4.Schema$Sheet> {
    const response = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            duplicateSheet: {
              sourceSheetId,
              newSheetName: destinationTitle,
            },
          },
        ],
      },
    });

    const duplicatedSheet = response.data.replies?.[0].duplicateSheet;
    if (!duplicatedSheet) {
      throw new Error('シートのコピーに失敗しました');
    }

    return { properties: duplicatedSheet.properties };
  }

  /**
   * データを書き込み
   */
  private async writeData(sheetId: number, data: CsvRow[]): Promise<void> {
    const values = data.map((row) => [
      row.name,
      row.employeeId,
      row.date,
      row.attendanceGroupId,
      row.groupName,
      row.scheduleTemplateId,
      row.startTime,
      row.endTime,
    ]);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `'${sheetId}'!A1:H${values.length}`,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });
  }

  /**
   * データを読み込み
   */
  private async readData(sheetId: number): Promise<CsvRow[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `'${sheetId}'!A:H`,
    });

    const values = response.data.values || [];
    return values.slice(1).map((row) => ({
      name: String(row[0] || ''),
      employeeId: String(row[1] || ''),
      date: String(row[2] || ''),
      attendanceGroupId: String(row[3] || ''),
      groupName: String(row[4] || ''),
      scheduleTemplateId: String(row[5] || ''),
      startTime: String(row[6] || ''),
      endTime: String(row[7] || ''),
    }));
  }

  /**
   * 差分を検出
   */
  private findDifferences(
    yesterdayData: CsvRow[],
    todayData: CsvRow[]
  ): DiffData[] {
    const differences: DiffData[] = [];

    // 新規登録と更新を検出
    for (const today of todayData) {
      const yesterday = yesterdayData.find(
        (y) => y.name === today.name && y.date === today.date
      );

      if (
        !yesterday ||
        yesterday.scheduleTemplateId !== today.scheduleTemplateId ||
        yesterday.startTime !== today.startTime ||
        yesterday.endTime !== today.endTime
      ) {
        differences.push({ ...today });
      }
    }

    // 削除を検出
    for (const yesterday of yesterdayData) {
      const exists = todayData.some(
        (t) => t.name === yesterday.name && t.date === yesterday.date
      );

      if (!exists) {
        differences.push({ ...yesterday, isDeleted: true });
      }
    }

    return differences;
  }
}

// ファクトリ関数をエクスポート
export function createSpreadsheetHandler(
  auth: any,
  spreadsheetId: string
): SpreadsheetHandler {
  return new SpreadsheetHandler(auth, spreadsheetId);
}
