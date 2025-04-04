import { calendar_v3, google } from 'googleapis';
import { createLogger } from './logger';
import { EVENT_CONSTANTS } from './config';
import { CalendarEvent, RetryConfig, EventProcessingOptions } from './types';

const logger = createLogger('CalendarHandler');

/**
 * カレンダー処理を管理するクラス
 */
export class CalendarHandler {
  private calendar: calendar_v3.Calendar;
  private retryConfig: RetryConfig;

  constructor(auth: any, retryConfig: RetryConfig) {
    this.calendar = google.calendar({ version: 'v3', auth });
    this.retryConfig = retryConfig;
  }

  /**
   * 終日イベントの作成または更新
   */
  public async processFullDayEvent(
    calendarId: string,
    date: Date,
    title: string,
    options: EventProcessingOptions = {},
  ): Promise<void> {
    try {
      logger.logStart('processFullDayEvent', { calendarId, date, title });

      // 既存の終日イベントを検索
      const existingEvents = await this.findExistingEvents(
        calendarId,
        date,
        true,
      );
      const existingEvent = existingEvents.find((event) => {
        const currentTitle = event.summary || '';
        return this.isTargetEvent(currentTitle);
      });

      if (existingEvent) {
        if (existingEvent.summary !== title) {
          // イベントの更新
          if (!options.dryRun) {
            await this.updateEventWithRetry(calendarId, existingEvent.id!, {
              summary: title,
            });
          }
          logger.info('終日イベントを更新しました', { title });
        }
      } else {
        // 新規イベントの作成
        if (!options.dryRun) {
          await this.createFullDayEventWithRetry(calendarId, date, title);
        }
        logger.info('終日イベントを作成しました', { title });
      }

      logger.logComplete('processFullDayEvent');
    } catch (error) {
      logger.logFailure('processFullDayEvent', error as Error);
      throw error;
    }
  }

  /**
   * 通常イベントの作成または更新
   */
  public async processEvent(
    calendarId: string,
    event: CalendarEvent,
    options: EventProcessingOptions = {},
  ): Promise<void> {
    try {
      logger.logStart('processEvent', { calendarId, event });

      // 既存のイベントを検索
      const existingEvents = await this.findExistingEvents(
        calendarId,
        event.startTime,
        false,
      );
      const existingEvent = existingEvents.find((e) => {
        const currentTitle = e.summary || '';
        return this.isTargetEvent(currentTitle);
      });

      if (existingEvent) {
        // イベントの更新
        if (!options.dryRun) {
          await this.updateEventWithRetry(calendarId, existingEvent.id!, {
            summary: event.title,
            start: { dateTime: event.startTime.toISOString() },
            end: { dateTime: event.endTime.toISOString() },
          });
        }
        logger.info('イベントを更新しました', { title: event.title });
      } else {
        // 新規イベントの作成
        if (!options.dryRun) {
          await this.createEventWithRetry(calendarId, event);
        }
        logger.info('イベントを作成しました', { title: event.title });
      }

      logger.logComplete('processEvent');
    } catch (error) {
      logger.logFailure('processEvent', error as Error);
      throw error;
    }
  }

  /**
   * イベントの削除
   */
  public async deleteEvents(
    calendarId: string,
    date: Date,
    options: EventProcessingOptions = {},
  ): Promise<void> {
    try {
      logger.logStart('deleteEvents', { calendarId, date });

      if (options.skipDeleted) {
        logger.info('イベント削除をスキップします');
        return;
      }

      const events = await this.findExistingEvents(calendarId, date, false);
      for (const event of events) {
        if (this.isTargetEvent(event.summary || '')) {
          if (!options.dryRun) {
            await this.deleteEventWithRetry(calendarId, event.id!);
          }
          logger.info('イベントを削除しました', { eventId: event.id });
        }
      }

      logger.logComplete('deleteEvents');
    } catch (error) {
      logger.logFailure('deleteEvents', error as Error);
      throw error;
    }
  }

  /**
   * 既存のイベントを検索
   */
  private async findExistingEvents(
    calendarId: string,
    date: Date,
    isAllDay: boolean,
  ): Promise<calendar_v3.Schema$Event[]> {
    try {
      const timeMin = new Date(date);
      timeMin.setHours(0, 0, 0, 0);

      const timeMax = new Date(date);
      timeMax.setHours(23, 59, 59, 999);

      const response = await this.calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
      });

      return (
        response.data.items?.filter((event) => {
          const hasDate = event.start?.date !== undefined;
          return isAllDay ? hasDate : !hasDate;
        }) || []
      );
    } catch (error) {
      logger.error('イベント検索に失敗しました', error as Error);
      throw error;
    }
  }

  /**
   * 終日イベントを作成（リトライ付き）
   */
  private async createFullDayEventWithRetry(
    calendarId: string,
    date: Date,
    title: string,
  ): Promise<void> {
    const createEvent = async () => {
      await this.calendar.events.insert({
        calendarId,
        requestBody: {
          summary: title,
          start: {
            date: this.formatDate(date),
          },
          end: {
            date: this.formatDate(date),
          },
          reminders: {
            useDefault: false,
          },
        },
      });
    };

    await this.executeWithRetry(createEvent);
  }

  /**
   * 通常イベントを作成（リトライ付き）
   */
  private async createEventWithRetry(
    calendarId: string,
    event: CalendarEvent,
  ): Promise<void> {
    const createEvent = async () => {
      await this.calendar.events.insert({
        calendarId,
        requestBody: {
          summary: event.title,
          start: {
            dateTime: event.startTime.toISOString(),
          },
          end: {
            dateTime: event.endTime.toISOString(),
          },
          reminders: {
            useDefault: false,
          },
        },
      });
    };

    await this.executeWithRetry(createEvent);
  }

  /**
   * イベントを更新（リトライ付き）
   */
  private async updateEventWithRetry(
    calendarId: string,
    eventId: string,
    eventPatch: Partial<calendar_v3.Schema$Event>,
  ): Promise<void> {
    const updateEvent = async () => {
      await this.calendar.events.patch({
        calendarId,
        eventId,
        requestBody: eventPatch,
      });
    };

    await this.executeWithRetry(updateEvent);
  }

  /**
   * イベントを削除（リトライ付き）
   */
  private async deleteEventWithRetry(
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    const deleteEvent = async () => {
      await this.calendar.events.delete({
        calendarId,
        eventId,
      });
    };

    await this.executeWithRetry(deleteEvent);
  }

  /**
   * リトライ処理を実行
   */
  private async executeWithRetry(
    operation: () => Promise<void>,
  ): Promise<void> {
    let attempt = 0;
    let delay = this.retryConfig.initialDelayMs;

    while (attempt < this.retryConfig.maxAttempts) {
      try {
        await operation();
        return;
      } catch (error) {
        attempt++;
        if (attempt === this.retryConfig.maxAttempts) {
          throw error;
        }

        logger.warn(
          `操作に失敗しました。${attempt}回目のリトライを実行します`,
          error as Error,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(
          delay * this.retryConfig.backoffMultiplier,
          this.retryConfig.maxDelayMs,
        );
      }
    }
  }

  /**
   * 日付をYYYY-MM-DD形式に変換
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * 対象とするイベントかどうかを判定
   */
  private isTargetEvent(title: string): boolean {
    return (
      title === EVENT_CONSTANTS.PUBLIC_HOLIDAY_TITLE ||
      title === EVENT_CONSTANTS.OUTSIDE_HOURS_TITLE ||
      /^\d+(\.\d+)?-\d+(\.\d+)?$/.test(title)
    );
  }
}

// シングルトンインスタンスをエクスポート
export function createCalendarHandler(
  auth: any,
  retryConfig: RetryConfig,
): CalendarHandler {
  return new CalendarHandler(auth, retryConfig);
}
