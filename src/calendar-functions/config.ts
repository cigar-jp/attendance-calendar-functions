import { EnvironmentConfig, RetryConfig } from './types';

/**
 * デフォルトのリトライ設定
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * カレンダーAPIのスコープ
 */
const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar'];

/**
 * スプレッドシートAPIのスコープ
 */
const SPREADSHEET_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * バッチ処理のサイズ
 */
const BATCH_SIZE = 100;

/**
 * 環境変数のバリデーション
 */
function validateEnvironmentVariables(): void {
  const requiredVars = ['SPREADSHEET_ID'];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`,
    );
  }
}

/**
 * 環境設定の取得
 */
export function getConfig(): EnvironmentConfig {
  validateEnvironmentVariables();

  return {
    spreadsheetId: process.env.SPREADSHEET_ID as string,
    calendarScopes: CALENDAR_SCOPES,
    spreadsheetScopes: SPREADSHEET_SCOPES,
    batchSize: Number(process.env.BATCH_SIZE) || BATCH_SIZE,
    retryConfig: {
      maxAttempts:
        Number(process.env.RETRY_MAX_ATTEMPTS) ||
        DEFAULT_RETRY_CONFIG.maxAttempts,
      initialDelayMs:
        Number(process.env.RETRY_INITIAL_DELAY_MS) ||
        DEFAULT_RETRY_CONFIG.initialDelayMs,
      maxDelayMs:
        Number(process.env.RETRY_MAX_DELAY_MS) ||
        DEFAULT_RETRY_CONFIG.maxDelayMs,
      backoffMultiplier:
        Number(process.env.RETRY_BACKOFF_MULTIPLIER) ||
        DEFAULT_RETRY_CONFIG.backoffMultiplier,
    },
  };
}

/**
 * ユーザーマップ
 */
export const USERS_MAP = [
  { name: '福田 真一', email: 's.fukuda@izumogroup.co.jp' },
  { name: '塩田 敬子', email: 't.shioda@izumogroup.co.jp' },
  { name: '坪井 彩華', email: 'a.tsuboi@izumogroup.co.jp' },
  { name: '南 沙希子', email: 's.minami@izumogroup.co.jp' },
  { name: '番場 舞', email: 'm.banba@izumogroup.co.jp' },
  { name: '齊藤 祐哉', email: 'y.saito@izumogroup.co.jp' },
  { name: '安井 誇美', email: 'k.yasui@izumogroup.co.jp' },
  { name: '河井 咲良', email: 's.kawai@yakumogeihinkan.jp' },
  { name: '岩永 千佳', email: 'c.iwanaga@yakumogeihinkan.jp' },
  { name: '吉池 紗江', email: 's.yoshiike@yakumogeihinkan.jp' },
  { name: '吉田 良', email: 'r.yoshida@izumogroup.co.jp' },
  { name: '久保 紅生', email: 'a.kubo@yakumogeihinkan.jp' },
  { name: '細川 星七', email: 's.hosokawa@izumogroup.jp' },
  { name: '山口 聖一', email: 's.yamaguchi@izumogroup.jp' },
  { name: '小川 航輝', email: 'k.ogawa@yakumogeihinkan.jp' },
  { name: '小嶋 未由璃', email: 'm.kojima@yakumogeihinkan.jp' },
  { name: '森下 桜', email: 's.morishita@yakumogeihinkan.jp' },
  { name: '中井 啓子', email: 'k.nakai@yakumogeihinkan.jp' },
  { name: '渡邉 美優', email: 'm.watanabe@yakumogeihinkan.jp' },
  { name: '堂本 和希', email: 'k.domoto@izumogroup.jp' },
  { name: '馬場 康成', email: 'y.baba@izumogroup.co.jp' },
  { name: '平澤 莉奈', email: 'r.hirasawa@izumogroup.jp' },
  { name: '牧野 吉泰', email: 'y.makino@yakumogeihinkan.jp' },
  { name: '林 龍矢', email: 'r.hayashi@izumogroup.jp' },
  { name: '竹澤 将', email: 's.takezawa@yakumogeihinkan.jp' },
  { name: '高橋 楓美花', email: 'f.takahashi@yakumogeihinkan.jp' },
  { name: '千崎奈緒美', email: 'n.senzaki@izumogroup.co.jp' },
  { name: '辻岡 沙織', email: 's.tsujioka@yakumogeihinkan.jp' },
  { name: '佐野 日奈子', email: 'h.sano@medelbeauty.jp' },
  { name: '柴山 佳奈', email: 'k.shibayama@medelbeauty.jp' },
  { name: '桒原 未来', email: 'm.kuwabara@medelbeauty.jp' },
];

/**
 * CSV関連の定数
 */
export const CSV_CONSTANTS = {
  FILE_NAME_PREFIX: '汎用データ(まるめ適用後)ダウンロード_',
  ENCODING: 'Shift_JIS',
  FIELDS: {
    NAME: 0,
    EMPLOYEE_ID: 1,
    DATE: 2,
    ATTENDANCE_GROUP_ID: 3,
    GROUP_NAME: 4,
    SCHEDULE_TEMPLATE_ID: 5,
    START_TIME: 6,
    END_TIME: 7,
  },
};

/**
 * スプレッドシート関連の定数
 */
export const SHEET_CONSTANTS = {
  TODAY_SUFFIX: '今日分',
  YESTERDAY_SUFFIX: '昨日分',
  MONTH_PREFIX_FORMAT: '%M月_',
};

/**
 * イベント関連の定数
 */
export const EVENT_CONSTANTS = {
  PUBLIC_HOLIDAY_TITLE: '公休',
  OUTSIDE_HOURS_TITLE: '業務時間外',
  DAY_START_TIME: '00:00',
  DAY_END_TIME: '24:00',
};
