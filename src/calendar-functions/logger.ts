import { ErrorLog } from './types';

/**
 * ログレベルの定義
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * ログメッセージの構造
 */
interface LogMessage {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

/**
 * ロガークラス
 */
export class Logger {
  private static instance: Logger;
  private context: string;

  private constructor(context: string) {
    this.context = context;
  }

  /**
   * ロガーインスタンスを取得
   */
  public static getInstance(context: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context);
    }
    return Logger.instance;
  }

  /**
   * ログメッセージを構築
   */
  private formatMessage(
    level: LogLevel,
    message: string,
    data?: unknown,
  ): LogMessage {
    return {
      timestamp: new Date().toISOString(),
      level,
      message: `[${this.context}] ${message}`,
      data,
    };
  }

  /**
   * ログ出力の共通処理
   */
  private log(logMessage: LogMessage): void {
    // Cloud Loggingのseverityレベルに合わせてコンソール出力
    const logData = {
      severity: logMessage.level,
      ...logMessage,
    };

    console.log(JSON.stringify(logData));
  }

  /**
   * デバッグログ
   */
  public debug(message: string, data?: unknown): void {
    this.log(this.formatMessage(LogLevel.DEBUG, message, data));
  }

  /**
   * 情報ログ
   */
  public info(message: string, data?: unknown): void {
    this.log(this.formatMessage(LogLevel.INFO, message, data));
  }

  /**
   * 警告ログ
   */
  public warn(message: string, data?: unknown): void {
    this.log(this.formatMessage(LogLevel.WARN, message, data));
  }

  /**
   * エラーログ
   */
  public error(
    message: string,
    error?: Error | ErrorLog,
    data?: unknown,
  ): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      errorCode:
        error instanceof Error
          ? error.name
          : error?.errorCode || 'UNKNOWN_ERROR',
      message:
        error instanceof Error ? error.message : error?.message || message,
      stackTrace: error instanceof Error ? error.stack : undefined,
      requestData: data,
    };

    this.log(this.formatMessage(LogLevel.ERROR, message, errorLog));
  }

  /**
   * 実行開始ログ
   */
  public logStart(functionName: string, params?: unknown): void {
    this.info(`Starting ${functionName}`, params);
  }

  /**
   * 実行完了ログ
   */
  public logComplete(functionName: string, result?: unknown): void {
    this.info(`Completed ${functionName}`, result);
  }

  /**
   * 実行失敗ログ
   */
  public logFailure(
    functionName: string,
    error: Error | ErrorLog,
    data?: unknown,
  ): void {
    this.error(`Failed ${functionName}`, error, data);
  }
}

/**
 * ログヘルパー関数
 */
export function createLogger(context: string): Logger {
  return Logger.getInstance(context);
}
