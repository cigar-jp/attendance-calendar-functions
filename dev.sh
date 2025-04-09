#!/bin/bash

# 環境変数の設定を確認
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

if [ ! -f service-account.json ]; then
    echo "Error: service-account.json not found"
    exit 1
fi

# 依存関係のインストール
npm install

# ビルド
npm run build

# デバッグサーバー起動
echo "Starting debug server..."
echo "Test data: src/calendar-functions/jinjer_汎用データ_15178_20250408210135.zip"
npm run dev
