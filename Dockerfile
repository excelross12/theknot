# Use Node.js 20 with Playwright dependencies
FROM mcr.microsoft.com/playwright:v1.58.0-jammy

# Set working directory
WORKDIR /app

# Copy package files from the scraper-automation-tool subdirectory
COPY scraper-automation-tool/package.json scraper-automation-tool/package-lock.json ./

# Install dependencies (including TypeScript for build)
RUN npm install

# Copy all source code from scraper-automation-tool subdirectory
COPY scraper-automation-tool/ ./

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port (Railway will override with $PORT)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["npm", "start"]
