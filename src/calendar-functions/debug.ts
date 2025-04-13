import * as fs from 'fs';
import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 環境変数の読み込み
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  throw new Error('.envファイルが見つかりません');
}
dotenv.config({ path: envPath });

import { createLogger } from './logger';
import { getConfig } from './config';
import { zipHandler } from './zip-handler';
import { createCalendarHandler } from './calendar-handler';
import { createSpreadsheetHandler } from './spreadsheet-handler';

const logger = createLogger('Debug');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  logger.info('デバッグ実行を開始', { dryRun });

  try {
    // ZIPファイルのパス
    const zipPath = path.resolve(
      process.cwd(),
      'src/calendar-functions/jinjer_汎用データ_15178_20250408210135.zip'
    );

    // ファイルの存在確認
    if (!fs.existsSync(zipPath)) {
      throw new Error(`ファイルが見つかりません: ${zipPath}`);
    }

    // ファイル読み込み
    const zipContent = await fs.promises.readFile(zipPath);
    logger.info('ZIPファイル読み込み完了', { size: zipContent.length });

    // 設定読み込み
    const config = getConfig();

    // サービスアカウントの認証情報を読み込み
    const keyFile = require(path.resolve(
      process.cwd(),
      process.env.GOOGLE_APPLICATION_CREDENTIALS as string
    ));

    // JWTクライアントを作成
    const auth = new JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: [...config.calendarScopes, ...config.spreadsheetScopes],
      subject: 'izm.master@izumogroup.co.jp', // 内部ユーザーを代理
    });

    // ハンドラー初期化
    const calendarHandler = createCalendarHandler(auth, config.retryConfig);
    const spreadsheetHandler = createSpreadsheetHandler(
      auth,
      config.spreadsheetId
    );

    // ZIP処理
    const zipResult = await zipHandler.processZipFile(zipContent);
    if (!zipResult.success || !zipResult.csvContent) {
      throw new Error('ZIPファイルの処理に失敗しました');
    }

    // CSV解析
    const rows = zipHandler.parseCsvContent(zipResult.csvContent);
    if (!zipHandler.validateCsvData(rows)) {
      throw new Error('CSVデータの検証に失敗しました');
    }

    // 月ごとにデータをグループ化
    const monthData = new Map<string, typeof rows>();
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
      logger.info(`${monthPrefix}の処理を開始`, { rowCount: data.length });

      // スプレッドシートを更新
      const updateResult = await spreadsheetHandler.updateSheets(
        data,
        monthPrefix
      );
      if (!updateResult.success) {
        throw new Error(
          `シートの更新に失敗しました: ${updateResult.error?.message}`
        );
      }
      logger.info(`${monthPrefix}のスプレッドシート更新完了`);

      // 差分を抽出して処理
      const diffResult = await spreadsheetHandler.extractDifferences(
        monthPrefix
      );
      if (!diffResult.success) {
        throw new Error(`差分抽出に失敗しました: ${diffResult.error?.message}`);
      }

      const differences = diffResult.data || [];
      logger.info(`${monthPrefix}の差分を検出`, { count: differences.length });

      // カレンダー更新
      if (differences.length > 0) {
        for (const diff of differences) {
          const eventDate = new Date(diff.date);

          // dryRunモードでは実際の更新は行わない
          if (!dryRun) {
            if (diff.isDeleted) {
              await calendarHandler.deleteEvents(diff.name, eventDate);
              logger.info('イベントを削除', {
                user: diff.name,
                date: eventDate,
              });
            } else {
              const title =
                diff.scheduleTemplateId === '0'
                  ? '公休'
                  : `${diff.startTime}-${diff.endTime}`;

              await calendarHandler.processFullDayEvent(
                diff.name,
                eventDate,
                title
              );
              logger.info('イベントを更新', {
                user: diff.name,
                date: eventDate,
                title,
              });
            }
          } else {
            logger.info('[DryRun] イベント更新をスキップ', {
              user: diff.name,
              date: eventDate,
              isDeleted: diff.isDeleted,
            });
          }
        }
        logger.info(`${monthPrefix}のカレンダー更新完了`, {
          updatedCount: differences.length,
        });
      }
    }

    logger.info('データ処理完了', {
      totalRows: rows.length,
      monthCount: monthData.size,
    });
  } catch (error) {
    logger.error('エラーが発生しました', error as Error);
    process.exit(1);
  }
}

// エントリーポイント
if (require.main === module) {
  main().catch((error) => {
    console.error('予期せぬエラーが発生しました:', error);
    process.exit(1);
  });
}
