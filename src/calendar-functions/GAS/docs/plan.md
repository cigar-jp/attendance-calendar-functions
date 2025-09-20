# 勤怠CSV処理のGCF移行計画

目的: 毎日届く jinjer 勤怠のZip(CSV/Shift-JIS)を人手なしで処理し、A〜H + CH 列のみを抽出→差分検出→Google カレンダー反映までを Google Cloud 上で定期自動実行する。巨大CSVの貼り付けでスプレッドシートが固まる課題を解消する。

## 現状（手作業フロー）
1) Gmail 受信: 件名「【jinjer勤怠】汎用データ_ダウンロード処理完了通知」、Zip(Shift-JIS) 添付
2) Zip 解凍 → CSV 展開
3) CSVを加工: A〜H 列と CH 列のみ残して他列削除（結果 9 列）
4) Google スプレッドシートへ貼り付け（「今日分」など）
5) GAS で processSheets 実行 → 差分作成＆カレンダー反映

課題:
- 元CSVは 1500行 × GL 列まであり巨大。貼り付けが重くフリーズする
- 手作業が毎日必要でヒューマンエラーのリスク

## 目標
- 完全自動化（深夜/早朝の定時バッチ）
- 大規模CSVでも安定動作（クラウド上で前処理/差分を計算し、低ボリュームのみを扱う）
- 障害時の検知と再実行が容易

## アーキテクチャオプション

### Option A: 最小移行（Sheets + 一部GAS併用）
- Cloud Functions(GCF) で Gmail からZip取得→CSVを縮約（A..H+CH の9列）→ Sheets API で「今日分」だけ更新
- 差分抽出と Calendar 更新は既存GASを流用（extractDifferences + processAllUsers）

メリット: 既存ロジック流用で実装量が最小。スプレッドシート書き込みは 1500×9 に縮小され軽量。
デメリット: Sheets/GAS に依存が残る。完全サーバレスではない。

### Option B: 完全サーバレス（GCS/Firestore + Calendar API）
- GCF で Gmail からZip取得→CSV縮約→昨日スナップショットと比較（GCS/Firestore 保持）→ Calendar API で直接反映
- スプレッドシート非依存。GAS不要。

メリット: 完全にクラウドで閉じ、UI操作不要。リトライ/監視/スケールが容易。
デメリット: カレンダー更新ロジックをGCF側で再実装。Workspace ドメインワイド委任などの権限設計が必要。

推奨: 段階的移行。Phase1 は Option A で早期安定化 → Phase2 で Option B に移行。

### 補足: 手順4/5のGCF実装可否と結論
- 可否: 可能。GCF上で差分抽出とGoogle Calendar API更新まで完結できる（Option B）。
- パフォーマンス/運用:
	- GAS: 簡便だが実行時間/日次クォータと大規模データ操作でのパフォーマンス制約あり。
	- GCF: コンテナ実行でリソース拡張が容易、ログ/監視/デプロイが一元化、スプレッドシートを介さないため堅牢。
- 結論: 中長期的には GCF で 4/5 も置換（Option B）を推奨。短期は Option A でリスク低く移行し、安定後に完全移行。

## 詳細設計（Phase1: 最小移行）

構成:
- Cloud Scheduler → Pub/Sub → Cloud Functions(2nd gen, Node.js 20)
- GCF: 
	- Gmail API: 指定クエリで当日メールを検索、Zip添付を取得
	- unzip と Shift-JIS デコード（`unzipper` / `yauzl` + `iconv-lite`）
	- CSVパース（`csv-parse` 等）→ 列縮約（0..7 および 85番目=CH）
	- Sheets API: 対象スプレッドシートの「今日分」を差し替え、既存の「昨日分」へローテーション（必要に応じて）
	- Apps Script 併用パターン:
		- 1) 「昨日分」へコピー → 「今日分」へ新データ反映
		- 2) 既存 GAS の `extractDifferences(monthPrefix)` を実行（Web エンドポイント or シート更新トリガ）
		- 3) `processAllUsers(diffData)` でカレンダー更新（既存ロジック）

処理フロー詳細:
1. Gmail 検索: label:jinjer勤怠 AND 件名完全一致
2. 最新メールから Zip 取得→ CSV抽出（Shift-JIS→UTF-8）
3. CSV → 配列 → 列縮約（A..H + CH）
4. 月の判定（`getDataMonths` 同等）→ 月ごとにデータ分割
5. Sheets API:
	 - monthPrefix = `${月}月_`
	 - `…_昨日分` を `…_今日分` のコピーで更新
	 - `…_今日分` を新規データで setValues（ヘッダー含むかは既存ルールに合わせる）
6. 差分抽出とカレンダー反映: 既存 GAS を起動
	 - 方式A: Apps Script を Web アプリ化して HTTP 呼び出し（安全なトークン必須）
	 - 方式B: シート更新後、GAS の時間主導トリガーが走る構成に変更（実行時刻を関門化）

必要なIAM/権限:
- GCF サービスアカウント
	- Gmail API 読取: Workspace ドメインワイド委任でユーザーを代理（推奨）または OAuth2 クライアントでトークン（Secret Manager格納）
	- Sheets API への編集（対象スプレッドシート共有）
	- Cloud Scheduler, Pub/Sub 起動権限

ライブラリ候補（Node.js）:
- iconv-lite（Shift-JIS デコード）
- unzipper または yauzl（Zip 展開）
- csv-parse（CSV パース）
- googleapis（Gmail/Sheets/Calendar 呼び出し）

エッジケース/設計考慮:
- メールが未着: スキップ＋通知
- 同日複数メール: 最新のみ採用（もしくは2件比較）
- CSVが空/壊れている: スキップ＋通知
- CH 列が存在しない: A..H のみで処理継続
- タイムゾーン: Asia/Tokyo 固定

運用/監視:
- Cloud Logging で処理ログ
- 失敗時通知: Cloud Monitoring アラート（メール/Slack）
- 冪等性: 同日同一処理の多重防止（実行キーを当日でロック or シートの最終更新で判定）

## 詳細設計（Phase2: 完全サーバレス）

構成:
- Cloud Scheduler → Pub/Sub → GCF (2nd gen)
- データ保存: Cloud Storage(GCS) または Firestore に「昨日分」スナップショット（ヘッダー＋A..H+CH）
- 差分抽出: GCF 内の純粋関数（既存 `extractDifferencesFromArrays` を移植）
- Calendar 更新: Google Calendar API で直接 upsert

処理フロー:
1. Gmail → Zip → CSV（同上）
2. 列縮約（A..H + CH）
3. GCS/Firestore から前回スナップショット読込 → 差分抽出（追加/変更/削除）
4. UsersMap（氏名→カレンダーID）で分配し、各カレンダーへ反映
	 - タイトル規則: 既存ロジックと同様（"公休" / "startDecimal-endDecimal"）
	 - 年次有給/リフレッシュ休暇ロジックも移植（終日＋業務時間外 9:00-21:00）
5. スナップショット更新（当日分で置換）

セキュリティ/権限:
- Gmail API: ドメインワイド委任（最も安定）。不可ならOAuthトークン保管
- Calendar API: ドメインワイド委任で各ユーザーのカレンダーIDに対して代理実行
- Secret Manager で各種資格情報を管理

スキーマ/キー:
- 行キー: `${name}_${dateISO}`
- 比較対象: [5]テンプレID, [6]出勤時刻, [7]退勤時刻（既存と同じ）
- 削除マーク: 'DELETE' を末尾付与

パフォーマンス:
- 1500行×9列 程度ならメモリ/CPUに十分収まる
- Gmail/Calendar 呼び出しは指数バックオフでリトライ

### カレンダー更新の冪等設計（GCF）
目的: GASの `processSheets` のロジックをGCFに移植し、同一日・同一ユーザー・同一条件の再実行でも重複作成しない。

キー設計:
- 行キー: `${name}_${dateISO}`（例: "山田太郎_2025-04-01"）
- 保存: Firestore か GCS(JSON) に key→eventId(s) を保存（終日/午前/午後/業務時間外などのタイプ別）

イベントタイプと要件:
- 終日イベント（タイトル: "公休" または "HH(.5)-HH(.5)"）
- 業務時間外（午前）: 00:00〜勤務開始
- 業務時間外（午後）: 勤務終了〜24:00
- 有給/リフレッシュ: 終日イベント＋9:00〜21:00 の業務時間外（重複作成禁止）

更新手順（擬似）:
1. key を元に保存済み eventId を取得
2. eventId が存在 → events.get で存在確認し、必要なら setTime/setSummary 相当の更新（Calendar API は patch）
3. eventId 無し → 当該時間帯で `q`（検索語）や時間窓で events.list し、同等イベントがあれば採用・更新、無ければ create
4. create/採用した eventId を保存（keyに紐づけてアップサート）

API呼び出しの指針:
- events.list は timeMin/timeMax + q="業務時間外" などで絞る
- 日付境界は Asia/Tokyo で ISO 文字列に統一
- 競合を避けるため、ユーザー毎に直列化 or keyベースのロック

タイトル変換:
- `convertTimeStringToDecimal` 相当をGCFで実装（"09:00"→"9", "20:30"→"20.5"）

差分検出:
- `extractDifferencesFromArrays` 相当の純粋関数をGCFへ移植
- 比較対象はテンプレID/出勤/退勤（[5],[6],[7]）＋必要に応じて休日休暇名1（[8]）

## 段階的移行計画

Phase 0（準備）
- GCP プロジェクト/課金/組織ポリシー確認
- サービスアカウント作成、必要API有効化（Gmail/Sheets/Calendar/Cloud Scheduler/PubSub/Secret Manager）
- ドメインワイド委任が可能か確認（Workspace 管理者対応）

Phase 1（Option A 実装）
- GCF 実装（Gmail→縮約→Sheets 更新）
- GAS 呼び出し方式の決定と実装（Webエンドポイント or トリガ）
- ステージング検証（テスト用スプレッドシート/カレンダー）
- 本番運用切替（平行稼働期間を設け差分検証）

Phase 2（Option B 実装）
- GCS/Firestore へのスナップショット保存と差分ロジック移植
- Calendar API 直接更新（UsersMap を環境変数/Firestore管理へ）
- Sheets/GAS 依存の撤去、モニタリング強化
 - （任意）既存GASを停止/アーカイブ、ドキュメント更新

ロールバック戦略:
- 失敗時は従来のGAS/手動フローへ即時切替
- GCF はデプロイ世代を前世代に戻す

## 実装タスク（チェックリスト）

- [ ] GCP プロジェクト準備とAPI有効化（Gmail/Sheets/Calendar/Scheduler/PubSub/Secrets）
- [ ] サービスアカウント作成、必要権限付与、（可能なら）ドメインワイド委任
- [ ] Secret Manager に認証情報格納（OAuth を使う場合）
- [ ] Cloud Scheduler（毎日6:00 JST）→ Pub/Sub → GCF トリガ
- [ ] GCF コード（Node.js）
	- [ ] Gmail 検索・Zip→CSV 抽出（Shift-JIS）
	- [ ] CSV パースと列縮約（A..H + CH）
	- [ ] 月ごと分割と Sheets 反映（Phase1）
	- [ ] （Phase2）前回スナップショット取得・差分抽出・Calendar 直接更新
	  - [ ] `extractDifferencesFromArrays` の移植とユニットテスト
	  - [ ] Calendar API upsert 実装（終日/午前/午後/有給対応）
	  - [ ] eventId 永続化（Firestore/GCS）と冪等実装
- [ ] ログ/メトリクス/アラート設定
- [ ] ステージング→本番デプロイ、並走比較、チューニング

## 開発メモ（雛形）

プロジェクト構成（例）:

```
cloud/
	functions/
		package.json
		src/
			index.ts        # エントリ（Pub/Sub ハンドラ）
			gmail.ts        # Gmail 取得/添付抽出
			csv.ts          # Shift-JIS decode, parse, 列縮約
			sheets.ts       # Sheets 反映（Phase1）
			diff.ts         # 差分計算（Phase2）
			calendar.ts     # Calendar API 反映（Phase2）
```

主な依存:
- googleapis, iconv-lite, unzipper (または yauzl), csv-parse, zod（バリデーション任意）

デプロイ（参考）:
- Cloud Functions 2nd gen + Pub/Sub トリガを使用
- Cloud Scheduler は Pub/Sub に毎日 06:00 JST を publish

## 受け入れ条件（Acceptance Criteria）
- 当日メールが存在する場合、処理が成功し、A..H+CH の 9列に縮約されたデータが（Phase1）Sheets に反映される
- （Phase1）既存の差分/カレンダー更新が自動実行される（またはGCFから起動）
- 実行ログが Cloud Logging に残る。エラー時は通知される
- 1500 行規模でもタイムアウト/メモリ不足なく完了

## 備考
- CH 列の位置が将来変動する可能性がある場合、ヘッダー名から列を特定する動的実装にする（Phase2で対応推奨）
- UsersMap（氏名↔カレンダーID）はコード埋め込みから Secret/Firestore 管理へ移行する

