import { google, gmail_v1, calendar_v3 } from 'googleapis';
import { Request, Response } from 'express';
import * as zip from 'jszip';
import csv from 'csv-parser';
import * as stream from 'stream';
import * as dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

// 認証情報の設定
const SERVICE_ACCOUNT_FILE = process.env.SERVICE_ACCOUNT_FILE || 'service-account.json';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar',
];

// サービスアカウントの認証
const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_FILE,
  scopes: SCOPES,
});

// Gmail API クライアントの作成
const gmail = google.gmail({ version: 'v1', auth });

// Google Calendar API クライアントの作成
const calendar = google.calendar({ version: 'v3', auth });

// カレンダーIDの設定（環境変数から取得）
const CALENDAR_ID = process.env.CALENDAR_ID || 'your_calendar_id@group.calendar.google.com';

// メイン関数
export const extractZipFromGmail = async (req: Request, res: Response) => {
  try {
    // Gmail メールの検索クエリを設定
    const query = 'subject:"勤怠表" has:attachment filename:zip';
    
    // メッセージの一覧を取得
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
    });
    
    const messages = messagesResponse.data.messages;
    
    if (!messages || messages.length === 0) {
      console.log('該当するメールが見つかりませんでした。');
      res.status(200).send('No relevant emails found.');
      return;
    }
    
    // 最新のメッセージを取得
    const messageId = messages[0].id!;
    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    
    const parts = messageResponse.data.payload?.parts;
    if (!parts) {
      console.log('メールに添付ファイルが含まれていません。');
      res.status(200).send('No attachments found in the email.');
      return;
    }
    
    // ZIPファイルの添付を探す
    let zipAttachment: gmail_v1.Schema$MessagePartBody | null = null;
    let zipFilename = '';
    
    for (const part of parts) {
      if (part.filename && part.filename.endsWith('.zip')) {
        zipFilename = part.filename;
        if (part.body?.attachmentId) {
          // 添付ファイルのデータを取得
          const attachment = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: messageId,
            id: part.body.attachmentId,
          });
          zipAttachment = attachment.data;
          break;
        } else if (part.body?.data) {
          zipAttachment = part.body;
          break;
        }
      }
    }
    
    if (!zipAttachment) {
      console.log('ZIPファイルの添付が見つかりませんでした。');
      res.status(200).send('No ZIP attachment found.');
      return;
    }
    
    // 添付ファイルのデータをデコード
    const zipData = Buffer.from(zipAttachment.data!, 'base64');
    
    // ZIPファイルの解凍
    const zipFiles = await unzipBuffer(zipData);
    
    // CSVファイルを探して処理
    for (const file of zipFiles) {
      if (file.name.endsWith('.csv')) {
        const csvContent = file.content.toString('utf-8');
        await processCsv(csvContent);
      }
    }
    
    res.status(200).send('Processing completed successfully.');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    res.status(500).send('An error occurred during processing.');
  }
};

// ZIPファイルを解凍する関数
const unzipBuffer = async (data: Buffer): Promise<{ name: string; content: Buffer }[]> => {
  const unzipped = await zip.loadAsync(data);
  
  const files: { name: string; content: Buffer }[] = [];
  
  const promises = Object.keys(unzipped.files).map(async (filename) => {
    const file = unzipped.files[filename];
    if (!file.dir) {
      const content = await file.async('nodebuffer');
      files.push({ name: filename, content });
    }
  });
  
  await Promise.all(promises);
  
  return files;
};

// CSVを解析し、Googleカレンダーにイベントを作成する関数
const processCsv = async (csvContent: string) => {
  return new Promise<void>((resolve, reject) => {
    const results: any[] = [];
    
    const readable = new stream.Readable();
    readable._read = () => {}; // No-op
    readable.push(csvContent);
    readable.push(null);
    
    readable
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          for (const row of results) {
            const employeeId = row['社員ID'];
            const dateStr = row['日付']; // 'YYYY-MM-DD'形式
            const attendance = row['勤怠情報']; // '出勤' または '休み' など
            
            if (!employeeId || !dateStr || !attendance) {
              console.log('不完全なデータ:', row);
              continue;
            }
            
            // 日付のパース
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              console.log('無効な日付形式:', dateStr);
              continue;
            }
            
            // 勤怠情報に基づいてイベントを作成
            const event = {
              summary: `社員ID: ${employeeId} 勤怠: ${attendance}`,
              start: {
                date: date.toISOString().split('T')[0],
                timeZone: 'Asia/Tokyo',
              },
              end: {
                date: date.toISOString().split('T')[0],
                timeZone: 'Asia/Tokyo',
              },
            };
            
            try {
              const createdEvent = await calendar.events.insert({
                calendarId: CALENDAR_ID,
                requestBody: event,
              });
              console.log(`イベントを作成しました: ${createdEvent.data.htmlLink}`);
            } catch (err) {
              console.error('イベント作成中にエラーが発生しました:', err);
            }
          }
          resolve();
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err: unknown) => {
        console.error('CSV解析中にエラーが発生しました:', err);
        reject(err);
      });
  });
};
