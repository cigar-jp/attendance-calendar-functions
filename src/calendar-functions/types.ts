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
 * リトライ設定のインターフェース
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * CSVの行データ
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
 * カレンダー更新用の差分データ
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
 * ユーザー情報
 */
export interface User {
  name: string;
  email: string;
}

/**
 * 実行レポート
 */
export interface ExecutionReport {
  startTime: string;
  endTime: string;
  processedFiles: number;
  processedEvents: number;
  errors: ExecutionError[];
}

/**
 * エラー情報
 */
export interface ExecutionError {
  timestamp: string;
  errorCode: string;
  message: string;
  stackTrace?: string;
}

/**
 * ZIP処理の結果
 */
export interface ZipProcessResult {
  success: boolean;
  csvContent?: string;
  error?: ExecutionError;
}

/**
 * スプレッドシート処理の結果
 */
export interface SpreadsheetResult {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * スプレッドシートの操作結果
 */
/**
 * スプレッドシートの操作エラー
 */
export interface SpreadsheetOperationError {
  timestamp: string;
  errorCode: string;
  message: string;
  details?: any;
  stackTrace?: string;
}

/**
 * スプレッドシートの操作結果
 */
export interface SpreadsheetOperationResult {
  success: boolean;
  message?: string;
  error?: SpreadsheetOperationError;
  data?: any;
}

/**
 * イベント処理オプション
 */
export interface EventProcessingOptions {
  dryRun?: boolean;
  retries?: number;
  interval?: number;
  skipDeleted?: boolean;
}
