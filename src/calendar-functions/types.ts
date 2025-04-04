/**
 * エラーログのインターフェース
 */
export interface ErrorLog {
  timestamp: string;
  errorCode: string;
  message: string;
  stackTrace?: string;
  requestData?: unknown;
}

/**
 * 実行レポートのインターフェース
 */
export interface ExecutionReport {
  startTime: string;
  endTime: string;
  processedFiles: number;
  processedEvents: number;
  errors: ErrorLog[];
}

/**
 * リトライ設定のインターフェース
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * ユーザー情報のインターフェース
 */
export interface User {
  name: string;
  email: string;
}

/**
 * CSV行データのインターフェース
 */
export interface CsvRow {
  name: string;
  employeeId: string;
  date: string;
  attendanceGroupId: string;
  groupName: string;
  scheduleTemplateId: string;
  startTime: string;
  endTime: string;
}

/**
 * 差分データのインターフェース
 */
export interface DiffData extends CsvRow {
  isDeleted?: boolean;
}

/**
 * カレンダーイベントのインターフェース
 */
export interface CalendarEvent {
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
}

/**
 * スプレッドシートの操作結果インターフェース
 */
export interface SpreadsheetOperationResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: ErrorLog;
}

/**
 * ZIPファイル処理結果のインターフェース
 */
export interface ZipProcessResult {
  success: boolean;
  csvContent?: string;
  error?: ErrorLog;
}

/**
 * 環境設定のインターフェース
 */
export interface EnvironmentConfig {
  spreadsheetId: string;
  calendarScopes: string[];
  spreadsheetScopes: string[];
  batchSize: number;
  retryConfig: RetryConfig;
}

/**
 * イベント処理オプションのインターフェース
 */
export interface EventProcessingOptions {
  dryRun?: boolean;
  forceUpdate?: boolean;
  skipDeleted?: boolean;
}
