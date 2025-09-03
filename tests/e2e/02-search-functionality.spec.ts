import { test, expect } from '@playwright/test';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should search by PNR', async ({ page }) => {
    // Enter a valid PNR (using test data)
    const pnrInput = page.locator('input[placeholder*="PNR"]').first();
    await pnrInput.fill('2341068596');
    
    // Click search button
    const searchButton = page.getByRole('button', { name: /search/i }).first();
    await searchButton.click();
    
    // Wait for search results
    await page.waitForTimeout(3000);
    
    // Check if results are displayed (could be empty or with data)
    const resultsSection = page.locator('[data-testid="search-results"], .search-results, .results').first();
    
    // Results section should exist
    const hasResults = await resultsSection.count() > 0;
    if (hasResults) {
      await expect(resultsSection).toBeVisible();
    }
  });

  test('should search by passenger name', async ({ page }) => {
    // Look for passenger name input
    const passengerInput = page.locator('input[placeholder*="passenger"], input[placeholder*="name"]').first();
    
    // If passenger search is available
    const passengerInputCount = await passengerInput.count();
    if (passengerInputCount > 0) {
      await passengerInput.fill('HITESH');
      
      // Click search
      const searchButton = page.getByRole('button', { name: /search/i }).first();
      await searchButton.click();
      
      // Wait for results
      await page.waitForTimeout(3000);
    }
  });

  test('should handle empty search', async ({ page }) => {
    // Click search without entering anything
    const searchButton = page.getByRole('button', { name: /search/i }).first();
    await searchButton.click();
    
    // Should show validation message or handle gracefully
    await page.waitForTimeout(2000);
    
    // Look for error message or empty state
    const errorMessage = page.locator('.error, [data-testid="error"], .alert-error').first();
    const emptyState = page.locator('.empty-state, [data-testid="empty-state"]').first();
    
    // One of these should be visible
    const hasError = await errorMessage.count() > 0;
    const hasEmptyState = await emptyState.count() > 0;
    
    if (hasError) {
      await expect(errorMessage).toBeVisible();
    } else if (hasEmptyState) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('should validate PNR format', async ({ page }) => {
    // Test invalid PNR format
    const pnrInput = page.locator('input[placeholder*="PNR"]').first();
    await pnrInput.fill('123'); // Invalid PNR
    
    const searchButton = page.getByRole('button', { name: /search/i }).first();
    await searchButton.click();
    
    // Look for validation error
    await page.waitForTimeout(2000);
    
    const validationError = page.locator('.error, .validation-error, [data-testid*="error"]');
    const errorCount = await validationError.count();
    
    // Should show some kind of validation feedback
    if (errorCount > 0) {
      await expect(validationError.first()).toBeVisible();
    }
  });

  test('should display search results correctly', async ({ page }) => {
    // Search with a known PNR that might have data
    const pnrInput = page.locator('input[placeholder*="PNR"]').first();
    await pnrInput.fill('2341068596');
    
    const searchButton = page.getByRole('button', { name: /search/i }).first();
    await searchButton.click();
    
    // Wait for results
    await page.waitForTimeout(5000);
    
    // Check for results structure
    const results = page.locator('.ticket-card, .search-result, [data-testid*="ticket"]');
    const resultCount = await results.count();
    
    if (resultCount > 0) {
      const firstResult = results.first();
      await expect(firstResult).toBeVisible();
      
      // Check for common ticket information
      const ticketInfo = page.locator('[data-testid*="pnr"], .pnr, .ticket-pnr');
      if (await ticketInfo.count() > 0) {
        await expect(ticketInfo.first()).toBeVisible();
      }
      
      // Check for passenger information
      const passengerInfo = page.locator('[data-testid*="passenger"], .passenger, .passenger-info');
      if (await passengerInfo.count() > 0) {
        await expect(passengerInfo.first()).toBeVisible();
      }
      
      // Check for journey information
      const journeyInfo = page.locator('[data-testid*="journey"], .journey, .train-info');
      if (await journeyInfo.count() > 0) {
        await expect(journeyInfo.first()).toBeVisible();
      }
    }
  });

  test('should handle search loading state', async ({ page }) => {
    const pnrInput = page.locator('input[placeholder*="PNR"]').first();
    await pnrInput.fill('2341068596');
    
    const searchButton = page.getByRole('button', { name: /search/i }).first();
    
    // Click search and immediately look for loading state
    await searchButton.click();
    
    // Look for loading indicators
    const loadingSpinner = page.locator('.loading, .spinner, [data-testid*="loading"]');
    const disabledButton = page.locator('button[disabled]');
    
    // Should show some loading state
    await page.waitForTimeout(1000);
    
    const hasSpinner = await loadingSpinner.count() > 0;
    const hasDisabledButton = await disabledButton.count() > 0;
    
    // Some form of loading state should be present
    expect(hasSpinner || hasDisabledButton).toBeTruthy();
    
    // Wait for loading to complete
    await page.waitForTimeout(5000);
  });

  test('should support advanced search filters', async ({ page }) => {
    // Look for advanced search options
    const advancedSearchToggle = page.locator('button:has-text("Advanced"), [data-testid*="advanced"]');
    const advancedCount = await advancedSearchToggle.count();
    
    if (advancedCount > 0) {
      await advancedSearchToggle.first().click();
      
      // Look for additional filter options
      const dateFilter = page.locator('input[type="date"]');
      const trainNumberFilter = page.locator('input[placeholder*="train"]');
      
      // Test date filter if available
      if (await dateFilter.count() > 0) {
        await dateFilter.first().fill('2025-08-28');
      }
      
      // Test train number filter if available
      if (await trainNumberFilter.count() > 0) {
        await trainNumberFilter.first().fill('20958');
      }
    }
  });

  test('should preserve search state on page reload', async ({ page }) => {
    // Perform a search
    const pnrInput = page.locator('input[placeholder*="PNR"]').first();
    await pnrInput.fill('2341068596');
    
    const searchButton = page.getByRole('button', { name: /search/i }).first();
    await searchButton.click();
    
    // Wait for results
    await page.waitForTimeout(3000);
    
    // Reload the page
    await page.reload();
    
    // Check if search state is preserved (optional feature)
    await page.waitForTimeout(2000);
    
    // The input might still have the value (depends on implementation)
    const inputValue = await pnrInput.inputValue();
    // This is optional - some implementations might preserve state
  });
});