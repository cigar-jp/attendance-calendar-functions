import { google } from 'googleapis';
import type { HttpFunction } from '@google-cloud/functions-framework';
import { Storage } from '@google-cloud/storage';
import { createLogger } from './logger';
import { USERS_MAP } from './config';
import { getConfig } from './config';
import { zipHandler } from './zip-handler';
import { createCalendarHandler } from './calendar-handler';
import { createSpreadsheetHandler } from './spreadsheet-handler';
import { CsvRow, DiffData, ExecutionReport } from './types';

const logger = createLogger('CloudFunction');

/**
 * Cloud Storage トリガーのイベントインターフェース
 */
interface CloudStorageEvent {
  bucket: string;
  name: string;
  metageneration: string;
  timeCreated: string;
  updated: string;
}

interface CloudContext {
  eventId: string;
  timestamp: string;
  eventType: string;
  resource: {
    service: string;
    name: string;
    type: string;
  };
}

/**
 * メイン処理のCloud Function
 */
export const processAttendanceData: HttpFunction = async (
  event: CloudStorageEvent,
  context: CloudContext,
) => {
  const startTime = new Date().toISOString();
  const report: ExecutionReport = {
    startTime,
    endTime: '',
    processedFiles: 0,
    processedEvents: 0,
    errors: [],
  };

  try {
    logger.logStart('processAttendanceData', { event, context });

    // 環境設定を取得
    const config = getConfig();

    // 認証クライアントを初期化
    const auth = await google.auth.getClient({
      scopes: [...config.calendarScopes, ...config.spreadsheetScopes],
    });

    // 各ハンドラーを初期化
    const calendarHandler = createCalendarHandler(auth, config.retryConfig);
    const spreadsheetHandler = createSpreadsheetHandler(
      auth,
      config.spreadsheetId,
    );

    // Cloud Storageからファイルを読み込み
    const storage = new Storage();
    const file = storage.bucket(event.bucket).file(event.name);
    const [content] = await file.download();

    // ZIPファイルを処理
    const zipResult = await zipHandler.processZipFile(content);
    if (!zipResult.success || !zipResult.csvContent) {
      throw new Error('ZIPファイルの処理に失敗しました');
    }

    // CSVデータをパース
    const rows = zipHandler.parseCsvContent(zipResult.csvContent);
    if (!zipHandler.validateCsvData(rows)) {
      throw new Error('CSVデータの検証に失敗しました');
    }

    // 月ごとにデータを処理
    const monthData = new Map<string, CsvRow[]>();
    for (const row of rows) {
      const date = new Date(row.date);
      const monthPrefix = `${date.getMonth() + 1}月_`;

      if (!monthData.has(monthPrefix)) {
        monthData.set(monthPrefix, []);
      }
      monthData.get(monthPrefix)!.push(row);
    }

    // 各月のデータを処理
    for (const [monthPrefix, data] of monthData.entries()) {
      // スプレッドシートを更新
      const updateResult = await spreadsheetHandler.updateSheets(
        data,
        monthPrefix,
      );
      if (!updateResult.success) {
        throw new Error(`シートの更新に失敗しました: ${updateResult.message}`);
      }

      // 差分を抽出
      const diffResult =
        await spreadsheetHandler.extractDifferences(monthPrefix);
      if (!diffResult.success) {
        throw new Error(`差分抽出に失敗しました: ${diffResult.message}`);
      }

      // カレンダーを更新
      const differences = diffResult.data as DiffData[];
      await processCalendarUpdates(calendarHandler, differences);
      report.processedEvents += differences.length;
    }

    report.processedFiles = 1;
    report.endTime = new Date().toISOString();
    logger.logComplete('processAttendanceData', report);
  } catch (error) {
    report.endTime = new Date().toISOString();
    report.errors.push({
      timestamp: new Date().toISOString(),
      errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : '不明なエラー',
      stackTrace: error instanceof Error ? error.stack : undefined,
    });

    logger.logFailure('processAttendanceData', error as Error, report);
    throw error;
  }
};

/**
 * カレンダー更新を処理
 */
async function processCalendarUpdates(
  calendarHandler: any,
  differences: DiffData[],
): Promise<void> {
  // ユーザーごとにデータをグループ化
  const userDiffs = new Map<string, DiffData[]>();
  for (const diff of differences) {
    if (!userDiffs.has(diff.name)) {
      userDiffs.set(diff.name, []);
    }
    userDiffs.get(diff.name)!.push(diff);
  }

  // 各ユーザーのカレンダーを更新
  for (const [name, diffs] of userDiffs.entries()) {
    try {
      const user = USERS_MAP.find((u) => u.name === name);
      if (!user) {
        logger.warn(`ユーザーが見つかりません: ${name}`);
        continue;
      }

      for (const diff of diffs) {
        const eventDate = new Date(diff.date);

        if (diff.isDeleted) {
          // イベントを削除
          await calendarHandler.deleteEvents(user.email, eventDate);
        } else {
          // 終日イベントを処理
          const title =
            diff.scheduleTemplateId === '0'
              ? '公休'
              : `${diff.startTime}-${diff.endTime}`;
          await calendarHandler.processFullDayEvent(
            user.email,
            eventDate,
            title,
          );

          // 勤務時間外イベントを処理
          if (
            diff.scheduleTemplateId !== '0' &&
            diff.startTime &&
            diff.endTime
          ) {
            const startTime = new Date(eventDate);
            const [startHour, startMinute] = diff.startTime.split(':');
            startTime.setHours(Number(startHour), Number(startMinute));

            const endTime = new Date(eventDate);
            const [endHour, endMinute] = diff.endTime.split(':');
            endTime.setHours(Number(endHour), Number(endMinute));

            // 業務時間外イベントを作成
            await calendarHandler.processEvent(user.email, {
              title: '業務時間外',
              startTime: new Date(eventDate.setHours(0, 0, 0)),
              endTime: startTime,
              isAllDay: false,
            });

            await calendarHandler.processEvent(user.email, {
              title: '業務時間外',
              startTime: endTime,
              endTime: new Date(eventDate.setHours(23, 59, 59)),
              isAllDay: false,
            });
          }
        }
      }
    } catch (error) {
      logger.error(
        `ユーザー ${name} の処理中にエラーが発生しました`,
        error as Error,
      );
      throw error;
    }
  }
}

/**
 * PubSubトリガーのCloud Function
 */
export const scheduledAttendanceUpdate: HttpFunction = async (
  _event: unknown,
  context: CloudContext,
) => {
  try {
    logger.logStart('scheduledAttendanceUpdate', { context });

    // メイン処理を呼び出し
    // 注: 実際のPubSub実装では、トリガー条件に応じた処理を実装
    logger.logComplete('scheduledAttendanceUpdate');
  } catch (error) {
    logger.logFailure('scheduledAttendanceUpdate', error as Error);
    throw error;
  }
};
