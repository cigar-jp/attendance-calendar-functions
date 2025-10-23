/// <reference path="./gas-globals.d.ts" />
// JSDoc で拾えない implicit any パラメータを明示的に型定義する補助 .d.ts
// 実装は scripts.gs 側。ここではシグネチャのみ宣言。

interface Error { details?: any }

declare function testIngestFromGmailOnce(): void;
declare function rotateAndWriteToNamesNoHash_(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  todayName: string,
  yesterdayName: string,
  values: AttendanceRow[]
): void;
declare function copyTestToRealNamesForMonth(month: number): void;
declare function deleteTestSheets(months?: number[]): void;

declare function getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet;
declare function toHex_(bytes: number[]): string;
declare function hashValues_(values: any[][]): string;
declare function notifySlack_(text: string): void;
declare function getOrCreateLabel_(name: string): GoogleAppsScript.Gmail.GmailLabel;
declare function decodeCsvText_(blob: GoogleAppsScript.Base.Blob): string;
declare function looksLikeCsv_(text: string): boolean;
declare function keepAHAndCHColumns(rows: AttendanceRow[]): AttendanceRow[];
declare function rotateAndWrite_(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  todayName: string,
  yesterdayName: string,
  values: AttendanceRow[]
): void;
declare function bucketByMonth_(rows: AttendanceRow[]): Map<number, AttendanceRow[]>;
declare function notifyFailure_(where: string, err: any): void;
declare function ingestFromGmail(): void;
declare function processSheets(): void;
declare function extractDifferences(monthPrefix: string): DiffRow[];
declare function processAllUsers(diffData: DiffRow[]): void;
declare function addEventsFromSpreadsheet(user: UserInfo, diffData: DiffRow[]): void;
declare function validateInputs(user: UserInfo): boolean;
declare function validateEventData(row: AttendanceRow, rowNum: number): { eventDate: Date; scheduleTemplateId: string; startTimeStr: string | Date; endTimeStr: string | Date } | null;
declare function generateEventTitle(scheduleTemplateId: string, startTimeStr: string | Date, endTimeStr: string | Date): string;
declare function processFullDayEvent(calendar: GoogleAppsScript.Calendar.Calendar, eventDate: Date, title: string, rowNum: number): void;
declare function processWorkingHoursEvents(calendar: GoogleAppsScript.Calendar.Calendar, eventDate: Date, startTimeStr: string | Date, endTimeStr: string | Date, rowNum: number): void;
declare function calculateWorkingTimes(eventDate: Date, startTimeStr: string | Date, endTimeStr: string | Date): { dayStart: Date; dayEnd: Date; workingStartTime: Date; workingEndTime: Date };
declare function processPeriodEvent(calendar: GoogleAppsScript.Calendar.Calendar, startTime: Date, endTime: Date, rowNum: number, period: string): void;
declare function convertTimeStringToDecimal(timeStr: string | Date): string;
