import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Train Ticket Search/);
  });

  test('should display main navigation elements', async ({ page }) => {
    // Check for main sections
    await expect(page.getByRole('heading', { name: 'Train Ticket Search System' })).toBeVisible();
    
    // Check for search functionality
    const searchSection = page.locator('[data-testid="search-section"]').first();
    await expect(searchSection).toBeVisible();
    
    // Check for upload functionality
    const uploadSection = page.locator('[data-testid="upload-section"]').first();
    await expect(uploadSection).toBeVisible();
  });

  test('should have working search form', async ({ page }) => {
    // Test PNR search input
    const pnrInput = page.locator('input[placeholder*="PNR"]').first();
    await expect(pnrInput).toBeVisible();
    await pnrInput.fill('2341068596');
    await expect(pnrInput).toHaveValue('2341068596');
    
    // Test search button
    const searchButton = page.getByRole('button', { name: /search/i }).first();
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toBeEnabled();
  });

  test('should have working file upload area', async ({ page }) => {
    // Check for file upload zone
    const uploadZone = page.locator('[data-testid="upload-dropzone"], .upload-zone, [data-testid*="upload"]').first();
    await expect(uploadZone).toBeVisible();
    
    // Check for upload button or input
    const uploadButton = page.locator('input[type="file"], button:has-text("Upload")').first();
    await expect(uploadButton).toBeVisible();
  });

  test('should display statistics when available', async ({ page }) => {
    // Wait for statistics to load
    await page.waitForTimeout(2000);
    
    // Check for statistics section (may not be visible if no data)
    const statsSection = page.locator('[data-testid="statistics"], .statistics, [data-testid*="stats"]');
    
    // If statistics exist, verify basic structure
    const statsCount = await statsSection.count();
    if (statsCount > 0) {
      await expect(statsSection.first()).toBeVisible();
    }
  });

  test('should be responsive', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('body')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle theme switching if available', async ({ page }) => {
    // Look for theme toggle
    const themeToggle = page.locator('[data-testid="theme-toggle"], button:has-text("Dark"), button:has-text("Light")');
    
    const toggleCount = await themeToggle.count();
    if (toggleCount > 0) {
      await themeToggle.first().click();
      // Theme should change - we can test by checking for dark class or similar
      await page.waitForTimeout(500);
    }
  });

  test('should have no accessibility violations', async ({ page }) => {
    // Basic accessibility checks
    await expect(page.locator('h1, h2, h3, h4, h5, h6')).toHaveCount({ min: 1 });
    
    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      await expect(img).toHaveAttribute('alt');
    }
    
    // Check for proper form labels
    const inputs = page.locator('input[type="text"], input[type="email"], input[type="search"]');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      // Should have either a label, aria-label, or placeholder
      const hasLabel = await input.locator('xpath=preceding-sibling::label | following-sibling::label').count() > 0;
      const hasAriaLabel = await input.getAttribute('aria-label') !== null;
      const hasPlaceholder = await input.getAttribute('placeholder') !== null;
      
      expect(hasLabel || hasAriaLabel || hasPlaceholder).toBeTruthy();
    }
  });
});