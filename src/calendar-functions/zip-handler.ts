import JSZip from 'jszip';
import iconv from 'iconv-lite';
import { parse as csvParse } from 'csv-parse/sync';
import { createLogger } from './logger';
import { CSV_CONSTANTS } from './config';
import { CsvRow, ZipProcessResult } from './types';

const logger = createLogger('ZipHandler');

/**
 * ZIPファイルを処理するクラス
 */
export class ZipHandler {
  /**
   * ZIPファイルからCSVデータを抽出して解析
   */
  public async processZipFile(zipBuffer: Buffer): Promise<ZipProcessResult> {
    try {
      logger.logStart('processZipFile');

      // ZIPファイルを解凍
      const zip = await JSZip.loadAsync(zipBuffer);

      // CSVファイルを検索
      const csvFiles = Object.entries(zip.files).filter(([name]) =>
        name.endsWith('.csv')
      );

      if (csvFiles.length === 0) {
        logger.warn('CSVファイルが見つかりません');
        return {
          success: false,
          error: {
            timestamp: new Date().toISOString(),
            errorCode: 'CSV_NOT_FOUND',
            message: 'CSVファイルが見つかりません',
          },
        };
      }

      // CSVファイルの内容を取得
      const [, file] = csvFiles[0];
      const csvBuffer = await file.async('nodebuffer');

      // ShiftJISからUTF-8に変換
      const csvString = iconv.decode(csvBuffer, CSV_CONSTANTS.ENCODING);

      logger.logComplete('processZipFile');
      return { success: true, csvContent: csvString };
    } catch (error) {
      logger.logFailure('processZipFile', error as Error);
      return {
        success: false,
        error: {
          timestamp: new Date().toISOString(),
          errorCode: 'ZIP_PROCESS_ERROR',
          message: error instanceof Error ? error.message : '不明なエラー',
          stackTrace: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  /**
   * CSVデータをパース
   */
  public parseCsvContent(csvContent: string): CsvRow[] {
    try {
      logger.logStart('parseCsvContent');

      // CSVをパース（ヘッダー行をスキップ）
      const records = csvParse(csvContent, {
        skip_empty_lines: true,
        from_line: 2, // ヘッダー行をスキップ
      });

      // 各行をCsvRow型に変換
      const rows: CsvRow[] = records.map((record: any[]) => ({
        name: String(record[CSV_CONSTANTS.FIELDS.NAME]),
        employeeId: String(record[CSV_CONSTANTS.FIELDS.EMPLOYEE_ID]),
        date: String(record[CSV_CONSTANTS.FIELDS.DATE]),
        attendanceGroupId: String(
          record[CSV_CONSTANTS.FIELDS.ATTENDANCE_GROUP_ID]
        ),
        groupName: String(record[CSV_CONSTANTS.FIELDS.GROUP_NAME]),
        scheduleTemplateId: String(
          record[CSV_CONSTANTS.FIELDS.SCHEDULE_TEMPLATE_ID]
        ),
        startTime: String(record[CSV_CONSTANTS.FIELDS.START_TIME]),
        endTime: String(record[CSV_CONSTANTS.FIELDS.END_TIME]),
      }));

      logger.logComplete('parseCsvContent', { rowCount: rows.length });
      return rows;
    } catch (error) {
      logger.logFailure('parseCsvContent', error as Error);
      throw error;
    }
  }

  /**
   * データの妥当性を検証
   */
  public validateCsvData(rows: CsvRow[]): boolean {
    try {
      logger.logStart('validateCsvData', { rowCount: rows.length });

      if (rows.length === 0) {
        logger.warn('CSVデータが空です');
        return false;
      }

      // 各行のデータ形式を検証
      for (const [index, row] of rows.entries()) {
        // 必須フィールドの存在チェック
        if (!row.name || !row.employeeId || !row.date) {
          logger.warn(`行 ${index + 1}: 必須フィールドが欠落しています`, {
            row,
          });
          return false;
        }

        // 日付形式の検証
        const date = new Date(row.date);
        if (isNaN(date.getTime())) {
          logger.warn(`行 ${index + 1}: 無効な日付形式です`, {
            date: row.date,
          });
          return false;
        }

        // 時刻形式の検証（スケジュールテンプレートIDが0でない場合）
        if (row.scheduleTemplateId !== '0') {
          const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
          if (row.startTime && !timeRegex.test(row.startTime)) {
            logger.warn(`行 ${index + 1}: 無効な開始時刻形式です`, {
              startTime: row.startTime,
            });
            return false;
          }
          if (row.endTime && !timeRegex.test(row.endTime)) {
            logger.warn(`行 ${index + 1}: 無効な終了時刻形式です`, {
              endTime: row.endTime,
            });
            return false;
          }
        }
      }

      logger.logComplete('validateCsvData', { isValid: true });
      return true;
    } catch (error) {
      logger.logFailure('validateCsvData', error as Error);
      return false;
    }
  }
}

// シングルトンインスタンスをエクスポート
export const zipHandler = new ZipHandler();
