#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo ".env file not found"
  exit 1
fi

# Deploy HTTP trigger function
gcloud functions deploy processAttendanceData \
  --gen2 \
  --runtime=nodejs18 \
  --trigger-http \
  --entry-point=processAttendanceData \
  --region=asia-northeast1 \
  --set-env-vars SPREADSHEET_ID=$SPREADSHEET_ID \
  --project=$GOOGLE_CLOUD_PROJECT

# Deploy scheduled function
gcloud functions deploy scheduledAttendanceUpdate \
  --gen2 \
  --runtime=nodejs18 \
  --trigger-bucket \
  --entry-point=scheduledAttendanceUpdate \
  --region=asia-northeast1 \
  --set-env-vars SPREADSHEET_ID=$SPREADSHEET_ID \
  --project=$GOOGLE_CLOUD_PROJECT

echo "Deployment completed successfully!"
