FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Install dependencies
RUN apt-get update && \
    apt-get install -y cron nano && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Tesseract OCR
RUN apt-get update && \
    apt-get install -y tesseract-ocr libtesseract-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy project files
COPY . .

# Create directory for chromium downloads
RUN mkdir -p /root/Downloads

# Setup cron job file
COPY app/pin-checker-details/automation/crontab /etc/cron.d/pin-checker-cron
RUN chmod 0644 /etc/cron.d/pin-checker-cron
RUN crontab /etc/cron.d/pin-checker-cron

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

# Start command
CMD ["sh", "-c", "cron && npm run start:pin-checker && tail -f /var/log/cron.log"]
