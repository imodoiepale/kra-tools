# Universal Automation Docker Image for Railway Deployment
FROM node:18

# Set environment variables
ENV NODE_ENV=production
ENV DOWNLOAD_FOLDER=/tmp/downloads
ENV AUTOMATION_TYPE=password-checker
ENV WORKER_ID=${RAILWAY_SERVICE_ID:-worker-1}
ENV BATCH_SIZE=5

# Create directories
RUN mkdir -p ${DOWNLOAD_FOLDER}

# Install required dependencies for Playwright and utilities
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libx11-6 \
    libxcb1 \
    libxext6 \
    libxtst6 \
    tesseract-ocr \
    libtesseract-dev \
    wget \
    ca-certificates \
    fonts-liberation \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Install Playwright browsers
RUN npx playwright install --with-deps chromium

# Create a data directory
RUN mkdir -p /app/data

# Copy the application code
COPY . .

# Support for dynamic automation selection
RUN echo '#!/bin/bash\n\
if [[ "$AUTOMATION_TYPE" == "password-checker" ]]; then\n\
  echo "Starting Password Checker Automation..."\n\
  node password-checker/index.js\n\
elif [[ "$AUTOMATION_TYPE" == "pin-checker" ]]; then\n\
  echo "Starting PIN Checker Automation..."\n\
  node pin-checker/index.js\n\
elif [[ "$AUTOMATION_TYPE" == "manufacturer-details" ]]; then\n\
  echo "Starting Manufacturer Details Automation..."\n\
  node manufacturer-details/index.js\n\
else\n\
  echo "Starting main server..."\n\
  node server.js\n\
fi' > /app/start.sh && chmod +x /app/start.sh

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the appropriate automation based on environment variables
CMD ["/app/start.sh"]