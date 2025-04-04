# 勤怠カレンダー同期 Cloud Functions

jinjerの勤怠データをGoogleカレンダーに同期するCloud Functions

## 機能概要

- Cloud StorageにアップロードされたZIPファイルから勤怠データを取得
- CSVデータを解析し、スプレッドシートに保存
- 差分を検出し、各ユーザーのGoogleカレンダーを更新
- 定期実行による自動同期

## 前提条件

- Node.js 18以上
- Google Cloud Platform アカウント
- 必要なIAMロール
  - Cloud Functions デプロイ権限
  - Cloud Storage アクセス権限
  - Google Calendar API アクセス権限
  - Google Spreadsheet API アクセス権限

## セットアップ

1. パッケージのインストール

```bash
npm install
```

2. 環境変数の設定

```bash
# .env.exampleをコピーして.envを作成
cp .env.example .env

# .envファイルを編集して必要な値を設定
vi .env
```

開発環境では、以下の手順で環境変数を設定します：

1. サービスアカウントキーの準備

   - Google Cloud Consoleでサービスアカウントを作成
   - JSONキーをダウンロード
   - プロジェクトのルートに保存（.gitignoreに追加）

2. .envファイルの設定

   - SPREADSHEET_ID: スプレッドシートのID
   - GOOGLE_CLOUD_PROJECT: GCPプロジェクトID
   - GOOGLE_APPLICATION_CREDENTIALS: サービスアカウントキーのパス

3. ビルド

```bash
npm run build
```

## デプロイ

### HTTP トリガー関数のデプロイ

```bash
npm run deploy
```

### スケジュール実行関数のデプロイ

```bash
npm run schedule-deploy
```

## ローカル開発

### 開発サーバーの起動

```bash
npm run start
```

### デバッグ実行

```bash
npm run dev
```

### テストの実行

```bash
npm test
```

## プロジェクト構成

```
src/
  ├── calendar-functions/     # メイン機能
  │   ├── calendar-handler.ts # カレンダー操作
  │   ├── config.ts          # 設定
  │   ├── debug.ts          # デバッグ用
  │   ├── index.ts          # エントリーポイント
  │   ├── logger.ts         # ログ機能
  │   ├── spreadsheet-handler.ts # スプレッドシート操作
  │   ├── types.ts          # 型定義
  │   └── zip-handler.ts    # ZIP/CSV処理
  └── index.ts              # Cloud Functions エントリーポイント

```

## 環境変数

| 変数名               | 説明                               | 必須 |
| -------------------- | ---------------------------------- | ---- |
| SPREADSHEET_ID       | 保存先スプレッドシートのID         | ✓    |
| GOOGLE_CLOUD_PROJECT | GCPプロジェクトID                  | ✓    |
| FUNCTION_TARGET      | Cloud Functions のターゲット関数名 | ✓    |
| K_SERVICE            | Cloud Functions のサービス名       | ✓    |

## デプロイ設定

### HTTP トリガー関数

- ランタイム: Node.js 18
- メモリ: 256MB
- タイムアウト: 60s
- 最小インスタンス数: 0
- 最大インスタンス数: 1
- リージョン: asia-northeast1
- 認証: 必須

### スケジュール実行関数

- ランタイム: Node.js 18
- メモリ: 256MB
- タイムアウト: 540s
- スケジュール: 毎日午前6時
- リージョン: asia-northeast1

## エラーハンドリング

エラー発生時は以下の処理を行います：

1. エラーログの出力（構造化ログ）
2. エラーレポートの生成
3. HTTPレスポンスへのエラー情報の含有
4. 必要に応じて再試行（リトライ処理）

## 監視とログ

- Cloud Loggingでログを確認可能
- エラー時のアラート設定を推奨
- 実行レポートには以下の情報が含まれます
  - 処理開始/終了時刻
  - 処理件数
  - エラー情報
  - 処理対象ファイル

## セキュリティ

- Cloud Functions の認証を有効化
- 適切なIAMロールの設定
- 環境変数による機密情報の管理
- アクセスログの監視

## 制限事項

- バッチサイズ: 100件/バッチ
- API呼び出し間隔: 100ms
- 同時実行数: 1インスタンス
- 処理タイムアウト: 540秒

## トラブルシューティング

1. デプロイエラー

   - IAM権限の確認
   - 環境変数の設定確認
   - リージョンの確認

2. 実行エラー

   - ログの確認
   - 認証情報の確認
   - APIクォータの確認

3. タイムアウト
   - バッチサイズの調整
   - 処理の分割検討

## ライセンス

Private - 社内利用限定
