// 型補助: Google Apps Script 環境の主なグローバル最低限ダミー定義
// VSCode 側で *.gs を javascript として扱う設定により型エラーが出るため抑制。
// 実行時はGASランタイムが本物を提供するので問題ありません。
// 必要に応じて拡張してください。

declare const PropertiesService: {
  getScriptProperties(): { getProperty(key: string): string | null; setProperty(key: string, value: string): void };
};

declare const SpreadsheetApp: {
  openById(id: string): any;
  getUi(): any;
};

declare const GmailApp: {
  search(query: string, start?: number, max?: number): any[];
  getUserLabelByName(name: string): any;
  createLabel(name: string): any;
};

declare const UrlFetchApp: {
  fetch(url: string, params?: any): any;
};

declare const MailApp: {
  sendEmail(options: { to: string; subject: string; htmlBody: string }): void;
};

declare const CalendarApp: {
  getCalendarById(id: string): any;
};

declare const Logger: {
  log(msg: any): void;
};

declare const Utilities: {
  unzip(blob: any): any[];
  parseCsv(text: string): string[][];
  computeDigest(alg: any, value: string): number[];
  DigestAlgorithm: { MD5: any };
  formatDate(date: Date, tz: string, fmt: string): string;
};

declare const Session: {
  getScriptTimeZone(): string;
};

// 汎用 any 型の簡易カレンダーイベント
interface GasCalendarEvent {
  isAllDayEvent(): boolean;
  getTitle(): string;
  setTitle(t: string): void;
  getStartTime(): Date;
  getEndTime(): Date;
  setTime(start: Date, end: Date): void;
}

// 抑止用 any 型
declare type Blob = any;

// Allow implicit any in forEach callbacks via minimal lib augmentation
// (実際のJS実行には影響なし)

// 追加の簡易ヘルパー型
interface UserInfo { name: string; email: string }
