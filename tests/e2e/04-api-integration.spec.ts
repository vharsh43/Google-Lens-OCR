import { test, expect } from '@playwright/test';

test.describe('API Integration Tests', () => {
  const API_BASE_URL = 'http://localhost:3001';

  test('should have healthy API server', async ({ page }) => {
    const response = await page.request.get(`${API_BASE_URL}/health`);
    expect(response.ok()).toBeTruthy();
    
    const health = await response.json();
    expect(health.status).toBe('healthy');
    expect(health.timestamp).toBeDefined();
    expect(health.uptime).toBeGreaterThan(0);
  });

  test('should get environment status', async ({ page }) => {
    const response = await page.request.get(`${API_BASE_URL}/api/env-status`);
    expect(response.ok()).toBeTruthy();
    
    const envStatus = await response.json();
    expect(envStatus).toHaveProperty('valid');
    // Environment might not be fully configured in test environment
  });

  test('should get database statistics', async ({ page }) => {
    const response = await page.request.get(`${API_BASE_URL}/api/stats`);
    
    // Should return statistics or appropriate message
    if (response.ok()) {
      const stats = await response.json();
      expect(stats).toBeDefined();
      
      // Check for expected statistics structure
      if (stats.tickets !== undefined) {
        expect(typeof stats.tickets).toBe('object');
      }
    } else {
      // If database is not available, should return meaningful error
      expect(response.status()).toBe(503);
    }
  });

  test('should search tickets by PNR', async ({ page }) => {
    const testPNR = '2341068596';
    const response = await page.request.get(`${API_BASE_URL}/api/tickets/search/pnr/${testPNR}`);
    
    if (response.ok()) {
      const results = await response.json();
      expect(Array.isArray(results)).toBeTruthy();
      
      // If results exist, verify structure
      if (results.length > 0) {
        const ticket = results[0];
        expect(ticket).toHaveProperty('pnr');
        expect(ticket.pnr).toBe(testPNR);
      }
    } else {
      // Database not available or no data
      expect([404, 503]).toContain(response.status());
    }
  });

  test('should search tickets by passenger name', async ({ page }) => {
    const response = await page.request.get(`${API_BASE_URL}/api/tickets/search/passenger?name=HITESH`);
    
    if (response.ok()) {
      const results = await response.json();
      expect(Array.isArray(results)).toBeTruthy();
      
      // If results exist, verify structure
      if (results.length > 0) {
        const ticket = results[0];
        expect(ticket).toHaveProperty('passengers');
        expect(Array.isArray(ticket.passengers)).toBeTruthy();
      }
    } else {
      // Database not available or no data
      expect([404, 503]).toContain(response.status());
    }
  });

  test('should handle advanced search', async ({ page }) => {
    const searchParams = {
      pnr: '2341068596',
      passengerName: 'HITESH',
      trainNumber: '20958'
    };

    const response = await page.request.post(`${API_BASE_URL}/api/tickets/search`, {
      data: searchParams
    });

    if (response.ok()) {
      const results = await response.json();
      expect(Array.isArray(results)).toBeTruthy();
    } else {
      // Database not available
      expect(response.status()).toBe(503);
    }
  });

  test('should get journey timeline', async ({ page }) => {
    const testPNR = '2341068596';
    const response = await page.request.get(`${API_BASE_URL}/api/tickets/${testPNR}/timeline`);
    
    if (response.ok()) {
      const timeline = await response.json();
      expect(timeline).toBeDefined();
      
      // Timeline should have journey structure if data exists
      if (timeline && timeline.timeline) {
        expect(Array.isArray(timeline.timeline)).toBeTruthy();
      }
    } else {
      // No data or database unavailable
      expect([404, 503]).toContain(response.status());
    }
  });

  test('should handle file upload endpoint', async ({ page }) => {
    // Test upload endpoint availability (without actually uploading)
    const response = await page.request.post(`${API_BASE_URL}/api/upload`, {
      data: new FormData() // Empty form data
    });

    // Should return 400 for missing file
    expect(response.status()).toBe(400);
    
    const error = await response.json();
    expect(error.error).toContain('No PDF file uploaded');
  });

  test('should get upload job status', async ({ page }) => {
    const fakeJobId = 'job_fake_123';
    const response = await page.request.get(`${API_BASE_URL}/api/status/${fakeJobId}`);
    
    // Should return 404 for non-existent job
    expect(response.status()).toBe(404);
    
    const error = await response.json();
    expect(error.error).toBe('Job not found');
  });

  test('should list all processing jobs', async ({ page }) => {
    const response = await page.request.get(`${API_BASE_URL}/api/jobs`);
    expect(response.ok()).toBeTruthy();
    
    const jobs = await response.json();
    expect(Array.isArray(jobs)).toBeTruthy();
    
    // Jobs array might be empty, which is fine
    if (jobs.length > 0) {
      const job = jobs[0];
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('status');
    }
  });

  test('should handle CORS properly', async ({ page }) => {
    // Test CORS headers
    const response = await page.request.get(`${API_BASE_URL}/health`);
    expect(response.ok()).toBeTruthy();
    
    const headers = response.headers();
    // CORS headers should be present for cross-origin requests
    expect(headers['access-control-allow-origin']).toBeDefined();
  });

  test('should validate request parameters', async ({ page }) => {
    // Test invalid PNR format
    const response = await page.request.get(`${API_BASE_URL}/api/tickets/search/pnr/123`);
    
    // Should handle invalid PNR gracefully
    if (!response.ok()) {
      expect([400, 404]).toContain(response.status());
    }
  });

  test('should handle rate limiting gracefully', async ({ page }) => {
    // Make multiple rapid requests to test rate limiting
    const promises = Array.from({ length: 10 }, () => 
      page.request.get(`${API_BASE_URL}/health`)
    );
    
    const responses = await Promise.all(promises);
    
    // All health checks should succeed (health endpoint shouldn't be rate limited)
    responses.forEach(response => {
      expect([200, 429]).toContain(response.status()); // 429 = Too Many Requests
    });
  });

  test('should return proper error responses', async ({ page }) => {
    // Test 404 endpoint
    const response = await page.request.get(`${API_BASE_URL}/api/nonexistent`);
    expect(response.status()).toBe(404);
    
    const error = await response.json();
    expect(error.error).toBe('Endpoint not found');
  });

  test('should handle malformed requests', async ({ page }) => {
    // Test malformed JSON
    const response = await page.request.post(`${API_BASE_URL}/api/tickets/search`, {
      data: 'invalid json',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Should return 400 for malformed JSON
    expect(response.status()).toBe(400);
  });

  test('should provide proper content-type headers', async ({ page }) => {
    const response = await page.request.get(`${API_BASE_URL}/api/stats`);
    
    if (response.ok()) {
      const headers = response.headers();
      expect(headers['content-type']).toContain('application/json');
    }
  });
});