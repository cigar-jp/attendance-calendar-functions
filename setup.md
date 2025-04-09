# ローカルセットアップ手順

## 1. サービスアカウントの設定

1. Google Cloud Consoleにアクセス

   - プロジェクト: `attendancetocalendar`を選択

2. サービスアカウントの作成

   ```bash
   # サービスアカウントを作成
   gcloud iam service-accounts create attendance-calendar-dev \
     --display-name="Attendance Calendar Dev"

   # 必要な権限を付与
   gcloud projects add-iam-policy-binding attendancetocalendar \
     --member="serviceAccount:attendance-calendar-dev@attendancetocalendar.iam.gserviceaccount.com" \
     --role="roles/calendar.editor"

   gcloud projects add-iam-policy-binding attendancetocalendar \
     --member="serviceAccount:attendance-calendar-dev@attendancetocalendar.iam.gserviceaccount.com" \
     --role="roles/spreadsheets.editor"
   ```

3. キーファイルのダウンロード
   - Google Cloud Console > IAMとセキュリティ > サービスアカウント
   - attendance-calendar-dev@attendancetocalendar.iam.gserviceaccount.com を選択
   - 「キーを作成」> JSONを選択
   - ダウンロードしたJSONファイルを`service-account.json`としてプロジェクトルートに配置

## 2. アクセス権限の設定

1. スプレッドシートの共有設定

   - スプレッドシートID: `1VyX1xU3m2T-hBSQwaKpunsIbh5OsWE4BUHs5TbdxX2o`
   - サービスアカウントのメールアドレスに編集権限を付与

2. カレンダーの共有設定
   - 各ユーザーのカレンダーにサービスアカウントのメールアドレスを追加
   - 「カレンダーの変更と管理」権限を付与

## 3. ローカル開発環境の準備

1. 依存関係のインストール

   ```bash
   npm install
   ```

2. 環境変数の確認

   ```bash
   # .envファイルが正しく設定されていることを確認
   cat .env
   ```

3. ビルド

   ```bash
   npm run build
   ```

4. ローカル実行

   ```bash
   # 開発サーバーの起動
   npm run start

   # デバッグ実行（特定のZIPファイルを処理）
   npm run dev
   ```

## 4. 動作確認

1. サンプルリクエストの送信

   ```bash
   curl -X POST http://localhost:8080 \
     -H "Content-Type: application/json" \
     -d '{
       "bucket": "local-debug",
       "name": "sample.zip"
     }'
   ```

2. ログの確認
   ```bash
   # ログ出力を確認
   tail -f logs/debug.log
   ```

## トラブルシューティング

1. 認証エラー

   - `GOOGLE_APPLICATION_CREDENTIALS`が正しく設定されているか確認
   - サービスアカウントキーファイルのパスが正しいか確認
   - 必要なIAMロールが付与されているか確認

2. アクセス権限エラー

   - スプレッドシートの共有設定を確認
   - カレンダーの共有設定を確認
   - サービスアカウントのメールアドレスが正しく追加されているか確認

3. 実行エラー
   - ログファイルを確認
   - 環境変数が正しく設定されているか確認
   - 依存関係が正しくインストールされているか確認
