# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/playwright:v1.62.1-jammy

WORKDIR /app

# Copy test files, config and package.json from the frontend root
COPY tests/e2e /app/tests/e2e
COPY playwright.config.ts /app/playwright.config.ts
COPY package.json /app/

# Install only Playwright (no dev deps needed)
RUN npm ci --omit=dev --prefer-offline && npx playwright install chromium

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD node -e "fetch(process.env.BASE_URL || 'http://frontend:3000').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["npx", "playwright", "test", "tests/e2e/full.spec.ts", "--reporter=list"]
