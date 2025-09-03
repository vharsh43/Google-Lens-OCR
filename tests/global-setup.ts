import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...');
  
  // Wait a moment for servers to be fully ready
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test basic connectivity
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Test API server health
    console.log('🔍 Testing API server health...');
    const apiResponse = await page.request.get('http://localhost:3001/health');
    if (!apiResponse.ok()) {
      throw new Error(`API server health check failed: ${apiResponse.status()}`);
    }
    console.log('✅ API server is healthy');

    // Test frontend accessibility
    console.log('🔍 Testing frontend accessibility...');
    const frontendResponse = await page.goto('http://localhost:3000');
    if (!frontendResponse?.ok()) {
      throw new Error('Frontend is not accessible');
    }
    console.log('✅ Frontend is accessible');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('✅ Playwright global setup completed successfully');
}

export default globalSetup;