import { ExecutionError } from './types';

/**
 * ログレベル
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * ログメッセージのインターフェース
 */
interface LogMessage {
  severity: LogLevel;
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

/**
 * ロガークラス
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * ログメッセージを作成
   */
  private createLogMessage(
    level: LogLevel,
    message: string,
    data?: any
  ): LogMessage {
    return {
      severity: level,
      timestamp: new Date().toISOString(),
      level,
      message: `[${this.context}] ${message}`,
      data,
    };
  }

  /**
   * ログを出力
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const logMessage = this.createLogMessage(level, message, data);
    console.log(JSON.stringify(logMessage));
  }

  /**
   * デバッグログ
   */
  debug(message: string, data?: any): void {
    this.log('DEBUG', message, data);
  }

  /**
   * 情報ログ
   */
  info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }

  /**
   * 警告ログ
   */
  warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }

  /**
   * エラーログ
   */
  error(message: string, error: Error): void {
    const errorData: ExecutionError = {
      timestamp: new Date().toISOString(),
      errorCode: error.name,
      message: error.message,
      stackTrace: error.stack,
    };
    this.log('ERROR', message, errorData);
  }

  /**
   * 処理開始ログ
   */
  logStart(functionName: string, data?: any): void {
    this.info(`Starting ${functionName}`, data);
  }

  /**
   * 処理完了ログ
   */
  logComplete(functionName: string, data?: any): void {
    this.info(`Completed ${functionName}`, data);
  }

  /**
   * 処理失敗ログ
   */
  logFailure(functionName: string, error: Error, data?: any): void {
    this.error(`Failed ${functionName}`, error);
    if (data) {
      this.error(
        `Additional data for ${functionName}`,
        new Error(JSON.stringify(data))
      );
    }
  }
}

/**
 * ロガーインスタンスを作成
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}
