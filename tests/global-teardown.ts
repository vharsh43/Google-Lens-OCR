import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Playwright global teardown...');
  
  // Add any cleanup tasks here
  // For example: close databases, clean up test files, etc.
  
  console.log('✅ Playwright global teardown completed');
}

export default globalTeardown;