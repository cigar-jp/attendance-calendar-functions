import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';
import { createLogger } from './logger';
import { getConfig, USERS_MAP } from './config';
import { User } from './types';
import { zipHandler } from './zip-handler';
import { createCalendarHandler } from './calendar-handler';
import { createSpreadsheetHandler } from './spreadsheet-handler';
import { CsvRow, DiffData } from './types';

const logger = createLogger('Debug');

/**
 * ローカルでZIPファイルを処理するデバッグ関数
 */
export async function processLocalZipFile(
  filePath: string,
  options = { dryRun: true },
): Promise<void> {
  try {
    logger.logStart('processLocalZipFile', { filePath, options });

    // 設定を取得
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

    // ローカルファイルを読み込み
    const storage = new Storage();
    const bucket = storage.bucket('local-debug');
    const file = bucket.file(filePath);
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
    const monthData = groupDataByMonth(rows);

    // 各月のデータを処理
    for (const [monthPrefix, data] of monthData.entries()) {
      await processMonthlyData(
        spreadsheetHandler,
        calendarHandler,
        monthPrefix,
        data,
        options,
      );
    }

    logger.logComplete('processLocalZipFile');
  } catch (error) {
    logger.logFailure('processLocalZipFile', error as Error);
    throw error;
  }
}

/**
 * データを月ごとにグループ化
 */
function groupDataByMonth(rows: CsvRow[]): Map<string, CsvRow[]> {
  const monthData = new Map<string, CsvRow[]>();

  for (const row of rows) {
    const date = new Date(row.date);
    const monthPrefix = `${date.getMonth() + 1}月_`;

    if (!monthData.has(monthPrefix)) {
      monthData.set(monthPrefix, []);
    }
    monthData.get(monthPrefix)!.push(row);
  }

  return monthData;
}

/**
 * 月次データを処理
 */
async function processMonthlyData(
  spreadsheetHandler: any,
  calendarHandler: any,
  monthPrefix: string,
  data: CsvRow[],
  options: { dryRun: boolean },
): Promise<void> {
  try {
    logger.logStart('processMonthlyData', {
      monthPrefix,
      rowCount: data.length,
    });

    // スプレッドシートを更新
    const updateResult = await spreadsheetHandler.updateSheets(
      data,
      monthPrefix,
    );
    if (!updateResult.success) {
      throw new Error(`シートの更新に失敗しました: ${updateResult.message}`);
    }

    // 差分を抽出
    const diffResult = await spreadsheetHandler.extractDifferences(monthPrefix);
    if (!diffResult.success) {
      throw new Error(`差分抽出に失敗しました: ${diffResult.message}`);
    }

    // カレンダー更新（dryRun: trueの場合は実際の更新は行わない）
    const differences = diffResult.data as DiffData[];
    await processCalendarUpdatesForDebug(
      calendarHandler,
      differences,
      options.dryRun,
    );

    logger.logComplete('processMonthlyData', {
      monthPrefix,
      diffCount: differences.length,
    });
  } catch (error) {
    logger.logFailure('processMonthlyData', error as Error);
    throw error;
  }
}

/**
 * デバッグ用のカレンダー更新処理
 */
async function processCalendarUpdatesForDebug(
  calendarHandler: any,
  differences: DiffData[],
  dryRun: boolean,
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
      const user = USERS_MAP.find((u: User) => u.name === name);
      if (!user) {
        logger.warn(`ユーザーが見つかりません: ${name}`);
        continue;
      }

      for (const diff of diffs) {
        const eventDate = new Date(diff.date);

        if (diff.isDeleted) {
          // イベントを削除
          if (!dryRun) {
            await calendarHandler.deleteEvents(user.email, eventDate);
          }
          logger.info(`[DryRun=${dryRun}] イベント削除`, {
            user: user.email,
            date: eventDate,
          });
        } else {
          // 終日イベントを処理
          const title =
            diff.scheduleTemplateId === '0'
              ? '公休'
              : `${diff.startTime}-${diff.endTime}`;

          if (!dryRun) {
            await calendarHandler.processFullDayEvent(
              user.email,
              eventDate,
              title,
            );
          }
          logger.info(`[DryRun=${dryRun}] 終日イベント作成/更新`, {
            user: user.email,
            date: eventDate,
            title,
          });

          // 勤務時間外イベントを処理
          if (
            diff.scheduleTemplateId !== '0' &&
            diff.startTime &&
            diff.endTime
          ) {
            await processOutsideHoursEvent(
              calendarHandler,
              user.email,
              eventDate,
              diff,
              dryRun,
            );
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
 * 勤務時間外イベントを処理
 */
async function processOutsideHoursEvent(
  calendarHandler: any,
  userEmail: string,
  eventDate: Date,
  diff: DiffData,
  dryRun: boolean,
): Promise<void> {
  const startTime = new Date(eventDate);
  const [startHour, startMinute] = diff.startTime.split(':');
  startTime.setHours(Number(startHour), Number(startMinute));

  const endTime = new Date(eventDate);
  const [endHour, endMinute] = diff.endTime.split(':');
  endTime.setHours(Number(endHour), Number(endMinute));

  // 始業前の業務時間外イベント
  const morningEvent = {
    title: '業務時間外',
    startTime: new Date(eventDate.setHours(0, 0, 0)),
    endTime: startTime,
    isAllDay: false,
  };

  if (!dryRun) {
    await calendarHandler.processEvent(userEmail, morningEvent);
  }
  logger.info(`[DryRun=${dryRun}] 勤務時間外イベント作成/更新（午前）`, {
    user: userEmail,
    ...morningEvent,
  });

  // 終業後の業務時間外イベント
  const eveningEvent = {
    title: '業務時間外',
    startTime: endTime,
    endTime: new Date(eventDate.setHours(23, 59, 59)),
    isAllDay: false,
  };

  if (!dryRun) {
    await calendarHandler.processEvent(userEmail, eveningEvent);
  }
  logger.info(`[DryRun=${dryRun}] 勤務時間外イベント作成/更新（午後）`, {
    user: userEmail,
    ...eveningEvent,
  });
}
