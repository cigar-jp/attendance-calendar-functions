export {
  processAttendanceData,
  scheduledAttendanceUpdate,
} from './calendar-functions/index';

// Cloud Functions v2のエントリーポイントとしてエクスポート
export const attendanceDataProcessor = processAttendanceData;
export const scheduledProcessor = scheduledAttendanceUpdate;

// 環境変数のバリデーション
const requiredEnvVars = [
  'SPREADSHEET_ID',
  'GOOGLE_CLOUD_PROJECT',
  'FUNCTION_TARGET',
  'K_SERVICE',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}

// Cloud Functions用のメタデータ
export const cloudFunctionMetadata = {
  processAttendanceData: {
    name: 'processAttendanceData',
    description: '勤怠データをカレンダーに同期するCloud Function',
    runtime: 'nodejs18',
    trigger: {
      type: 'http',
      allowUnauthenticated: false,
    },
    environment: {
      variables: {
        SPREADSHEET_ID: process.env.SPREADSHEET_ID,
      },
    },
    labels: {
      deployment: 'attendance-calendar',
    },
  },
  scheduledAttendanceUpdate: {
    name: 'scheduledAttendanceUpdate',
    description: '定期的に勤怠データを同期するCloud Function',
    runtime: 'nodejs18',
    trigger: {
      type: 'pubsub',
      schedule: '0 6 * * *', // 毎日午前6時に実行
    },
    environment: {
      variables: {
        SPREADSHEET_ID: process.env.SPREADSHEET_ID,
      },
    },
    labels: {
      deployment: 'attendance-calendar',
    },
  },
};
