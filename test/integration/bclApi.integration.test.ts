/**
 * BCL API integration tests
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { BCLApiClient } from '../../src/services/bclApiClient';
import config from '../../src/config';
import fs from 'fs';
import path from 'path';

// These tests interact with the real BCL API
// They are integration tests that test the BCL API client functionality
describe('BCL API Integration', () => {
  let bclApiClient: BCLApiClient;
  
  beforeAll(() => {
    // Create a BCL API client with the real API URL
    bclApiClient = new BCLApiClient(config.bcl.apiUrl);
    
    // Ensure measures directory exists
    if (!fs.existsSync(config.bcl.measuresDir)) {
      fs.mkdirSync(config.bcl.measuresDir, { recursive: true });
    }
    
    // Ensure temp directory exists
    if (!fs.existsSync(config.bcl.tempDir)) {
      fs.mkdirSync(config.bcl.tempDir, { recursive: true });
    }
  });
  
  it('should search for measures', async () => {
    // Skip this test in CI environments
    if (process.env.CI) {
      return;
    }
    
    const measures = await bclApiClient.searchMeasures('lighting');
    
    expect(Array.isArray(measures)).toBe(true);
    expect(measures.length).toBeGreaterThan(0);
    
    // Check that measures have the expected properties
    const measure = measures[0];
    expect(measure).toHaveProperty('id');
    expect(measure).toHaveProperty('name');
    expect(measure).toHaveProperty('description');
    expect(measure).toHaveProperty('version');
  }, 10000); // Increase timeout for API call
  
  it('should recommend measures based on context', async () => {
    // Skip this test in CI environments
    if (process.env.CI) {
      return;
    }
    
    const measures = await bclApiClient.recommendMeasures('energy efficiency lighting');
    
    expect(Array.isArray(measures)).toBe(true);
    expect(measures.length).toBeGreaterThan(0);
    
    // Check that measures have the expected properties
    const measure = measures[0];
    expect(measure).toHaveProperty('id');
    expect(measure).toHaveProperty('name');
    expect(measure).toHaveProperty('description');
    expect(measure).toHaveProperty('version');
  }, 10000); // Increase timeout for API call
  
  it('should handle API errors gracefully', async () => {
    // Create a client with an invalid URL
    const invalidClient = new BCLApiClient('https://invalid-url.example.com');
    
    // Search should return an empty array on error
    const measures = await invalidClient.searchMeasures('lighting');
    
    expect(Array.isArray(measures)).toBe(true);
    expect(measures.length).toBe(0);
  });
});