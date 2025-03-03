FROM mcr.microsoft.com/playwright:v1.41.0-jammy

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy automation scripts
COPY . .

# Install Playwright browsers
RUN npx playwright install chromium
RUN npx playwright install-deps

# Set environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Start the automation service
CMD ["node", "server.js"]
