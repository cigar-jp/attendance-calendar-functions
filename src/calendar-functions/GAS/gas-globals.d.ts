// 型補助: Google Apps Script 環境の主なグローバル最低限ダミー定義
// VSCode 側で *.gs を javascript として扱う設定により型エラーが出るため抑制。
// 実行時はGASランタイムが本物を提供するので問題ありません。
// 必要に応じて拡張してください。

declare const PropertiesService: {
  getScriptProperties(): { getProperty(key: string): string | null; setProperty(key: string, value: string): void };
};

declare namespace GoogleAppsScript {
  namespace Spreadsheet {
    interface Range {
      getValues(): any[][];
      setValues(values: any[][]): void;
    }
    interface Sheet {
      getName(): string;
      getDataRange(): Range;
      clearContents(): void;
      getRange(row: number, col: number, numRows: number, numCols: number): Range;
      deleteColumns(column: number, howMany: number): void;
      getLastColumn(): number;
    }
    interface Spreadsheet {
      getSheetByName(name: string): Sheet | null;
      insertSheet(name: string): Sheet;
      getSheets(): Sheet[];
      getActiveSheet(): Sheet;
    }
  }
  namespace Gmail {
    interface GmailLabel { addToThread(thread: any): void }
  }
  namespace Calendar {
    interface CalendarEvent {
      isAllDayEvent(): boolean;
      getTitle(): string;
      setTitle(t: string): void;
      getStartTime(): Date;
      getEndTime(): Date;
      setTime(start: Date, end: Date): void;
    }
    interface Calendar {
      getEvents(start: Date, end: Date, opts?: any): CalendarEvent[];
      getEventsForDay(d: Date): CalendarEvent[];
      createAllDayEvent(title: string, date: Date, opts?: any): CalendarEvent;
      createEvent(title: string, start: Date, end: Date, opts?: any): CalendarEvent;
    }
  }
  namespace Base { interface Blob { getName(): string; getDataAsString(charset?: string): string } }
}

declare const SpreadsheetApp: {
  openById(id: string): GoogleAppsScript.Spreadsheet.Spreadsheet;
  getUi(): any;
};

declare const GmailApp: {
  search(query: string, start?: number, max?: number): any[];
  getUserLabelByName(name: string): GoogleAppsScript.Gmail.GmailLabel | null;
  createLabel(name: string): GoogleAppsScript.Gmail.GmailLabel;
};

declare const UrlFetchApp: {
  fetch(url: string, params?: any): any;
};

declare const MailApp: {
  sendEmail(options: { to: string; subject: string; htmlBody: string }): void;
};

declare const CalendarApp: {
  getCalendarById(id: string): GoogleAppsScript.Calendar.Calendar | null;
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
declare type Blob = GoogleAppsScript.Base.Blob;

// Allow implicit any in forEach callbacks via minimal lib augmentation
// (実際のJS実行には影響なし)

// 追加の簡易ヘルパー型
interface UserInfo { name: string; email: string }

// 勤怠CSV 1行の概念的型（柔らかい定義）
// インデックス対応: 0=名前,1=従業員ID,2=日付,5=スケジュール雛形ID,6=出勤予定,7=退勤予定,8=休日休暇名1
type AttendanceRow = [
  name: string,
  employeeId: string,
  dateValue: string | Date,
  colD?: any,
  colE?: any,
  scheduleTemplateId?: string | number,
  start?: string | Date,
  end?: string | Date,
  leaveType?: string,
  ...rest: any[]
];

// 差分行: DELETE タグ付与の可能性
type DiffRow = AttendanceRow | [...AttendanceRow, 'DELETE'];
