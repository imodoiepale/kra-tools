# Password Checker Automation Docker Image for Railway Deployment
FROM node:18-slim

# Set environment variables
ENV NODE_ENV=production
ENV DOWNLOAD_FOLDER=/tmp/downloads
ENV WORKER_ID=${RAILWAY_SERVICE_ID}

# Create directories
RUN mkdir -p ${DOWNLOAD_FOLDER}

# Install required dependencies for Playwright
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

# Set working directory
WORKDIR /app

# Copy package files
COPY automations/package*.json ./

# Install Node.js dependencies
RUN npm install

# Install Playwright browsers
RUN npx playwright install --with-deps chromium

# Copy only the password checker files
COPY automations/password-checker ./password-checker/
COPY automations/.env ./.env

# Override the type in package.json for CommonJS compatibility
RUN node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('./package.json'));delete pkg.type;fs.writeFileSync('./package.json',JSON.stringify(pkg,null,2));"

# Expose the application port
EXPOSE 3000

# Start the password checker service
CMD ["node", "password-checker/index.js"]
