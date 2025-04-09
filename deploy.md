# デプロイ手順

## 1. 事前準備

1. gcloudコマンドラインツールのインストール

   ```bash
   # gcloud CLIのインストール確認
   gcloud --version
   ```

2. プロジェクトの設定

   ```bash
   # プロジェクトを設定
   gcloud config set project attendancetocalendar

   # ログイン確認
   gcloud auth list
   ```

3. 必要なAPIの有効化

   ```bash
   # Cloud Functions APIを有効化
   gcloud services enable cloudfunctions.googleapis.com

   # Cloud Build APIを有効化
   gcloud services enable cloudbuild.googleapis.com

   # Cloud Scheduler APIを有効化
   gcloud services enable cloudscheduler.googleapis.com
   ```

4. デプロイスクリプトの準備
   ```bash
   # deploy.shに実行権限を付与
   chmod +x deploy.sh
   ```

## 2. HTTPトリガー関数のデプロイ

1. 環境変数の確認

   ```bash
   # .envファイルの内容を確認
   cat .env
   ```

2. ビルド

   ```bash
   npm run build
   ```

3. デプロイ実行
   ```bash
   ./deploy.sh
   # または
   npm run deploy
   ```

## 3. スケジュール実行関数のデプロイ

1. Topic作成

   ```bash
   # PubSubトピックを作成
   gcloud pubsub topics create attendance-update
   ```

2. スケジュール設定

   ```bash
   # 毎日午前6時に実行するスケジューラを作成
   gcloud scheduler jobs create pubsub attendance-daily-update \
     --schedule="0 6 * * *" \
     --topic=attendance-update \
     --message-body="{}" \
     --time-zone="Asia/Tokyo"
   ```

3. デプロイ実行
   ```bash
   npm run schedule-deploy
   ```

## 4. デプロイ後の確認

1. 関数の状態確認

   ```bash
   # デプロイされた関数の一覧を表示
   gcloud functions list

   # HTTP関数のURLを取得
   gcloud functions describe processAttendanceData --format='value(httpsTrigger.url)'
   ```

2. ログの確認

   ```bash
   # ログを表示
   gcloud functions logs read processAttendanceData --limit=50
   gcloud functions logs read scheduledAttendanceUpdate --limit=50
   ```

3. テスト実行
   ```bash
   # HTTP関数のテスト
   curl -X POST [FUNCTION_URL] \
     -H "Authorization: bearer $(gcloud auth print-identity-token)" \
     -H "Content-Type: application/json" \
     -d '{
       "bucket": "your-bucket",
       "name": "your-file.zip"
     }'
   ```

## トラブルシューティング

1. デプロイエラー

   - ビルドログの確認
   - IAM権限の確認
   - APIの有効化状態の確認

2. 実行エラー

   - Cloud Loggingでログを確認
   - 環境変数の設定確認
   - サービスアカウントの権限確認

3. スケジュール実行の問題
   - Cloud Schedulerのジョブ状態確認
   - PubSubトピックの設定確認
   - タイムゾーン設定の確認

## 運用メモ

- 開発環境でのテスト実行を推奨
- 本番デプロイ前にステージング環境での確認を実施
- エラー通知の設定を推奨
- 定期的なログの確認が必要
