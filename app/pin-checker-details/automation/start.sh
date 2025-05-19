#!/bin/bash

# Script to start the PIN Checker automation service

# Start cron service
service cron start

# Run the pin checker automation once at startup if AUTO_RUN is enabled
if [ "$AUTO_RUN" = "true" ]; then
  echo "Running initial automation at startup..."
  node /app/app/pin-checker-details/automation/run-automation.js
fi

# Start the Next.js application
cd /app
npm run start
