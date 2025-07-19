/**
 * Output processor tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutputProcessor, OutputFormat } from '../src/utils/outputProcessor';

// Mock logger
vi.mock('../src/utils/logger', async () => {
  return {
    default: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }
  };
});

describe('Output Processor', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
  let outputProcessor: OutputProcessor;
  
  beforeEach(() => {
    outputProcessor = new OutputProcessor();
    vi.clearAllMocks();
  });
  
  describe('summarizeText', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should summarize short output', () => {
      const output = 'This is a short output that does not need summarization.';
      const summary = outputProcessor.summarizeText(output);
      expect(summary).toBe(output);
    });
    
    it('should summarize long output', () => {
      const output = `
        This is a very long output that should be summarized.
        It contains multiple lines of text.
        Some of these lines are important.
        Others are not as important.
        But we want to make sure that the summary captures the essence of the output.
        This line contains an ERROR: Something went wrong.
        This line contains a WARNING: Something might be wrong.
        This line contains INFO: Everything is fine.
        This is the end of the output.
      `.repeat(10); // Make it really long
      
      const summary = outputProcessor.summarizeText(output);
      
      expect(summary.length).toBeLessThan(output.length);
      expect(summary).toContain('ERROR: Something went wrong');
      expect(summary).toContain('WARNING: Something might be wrong');
    });
    
    it('should handle empty or null input', () => {
      expect(outputProcessor.summarizeText('')).toBe('');
      expect(outputProcessor.summarizeText(null)).toBe('');
      expect(outputProcessor.summarizeText(undefined)).toBe('');
    });
  });
  
  describe('extractHighlights', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should extract highlights based on keywords', () => {
      const output = `
        Starting simulation...
        Processing input...
        ERROR: Invalid input parameter 'temperature'
        Continuing with default value...
        WARNING: Model may not be accurate
        Simulation completed.
      `;
      
      const highlights = outputProcessor.extractHighlights(output);
      
      expect(highlights.length).toBeGreaterThan(0);
      expect(highlights).toContainEqual(expect.stringContaining('ERROR: Invalid input parameter'));
      expect(highlights).toContainEqual(expect.stringContaining('WARNING: Model may not be accurate'));
    });
    
    it('should handle output without highlights', () => {
      const output = `
        Starting simulation...
        Processing input...
        Simulation running...
      `;
      
      // Override the default keywords to ensure no matches
      const highlights = outputProcessor.extractHighlights(output, ['ERROR', 'WARNING', 'CRITICAL']);
      
      expect(highlights).toHaveLength(0);
    });
    
    it('should handle empty or null input', () => {
      expect(outputProcessor.extractHighlights('')).toEqual([]);
      expect(outputProcessor.extractHighlights(null)).toEqual([]);
      expect(outputProcessor.extractHighlights(undefined)).toEqual([]);
    });
  });
  
  describe('formatOutput', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should format output as text', () => {
      const output = { key: 'value', number: 42 };
      const formatted = outputProcessor.formatOutput(output, OutputFormat.TEXT);
      
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('key');
      expect(formatted).toContain('value');
      expect(formatted).toContain('42');
    });
    
    it('should format output as JSON', () => {
      const output = { key: 'value', number: 42 };
      const formatted = outputProcessor.formatOutput(output, OutputFormat.JSON);
      
      expect(typeof formatted).toBe('object');
      expect(formatted).toEqual(output);
    });
    
    it('should format output as table', () => {
      const output = { key: 'value', number: 42 };
      const formatted = outputProcessor.formatOutput(output, OutputFormat.TABLE);
      
      expect(formatted).toHaveProperty('headers');
      expect(formatted).toHaveProperty('rows');
      expect(formatted.headers).toContain('Property');
      expect(formatted.headers).toContain('Value');
    });
    
    it('should format output as chart data', () => {
      const output = { key1: 10, key2: 20, key3: 30 };
      const formatted = outputProcessor.formatOutput(output, OutputFormat.CHART);
      
      expect(formatted).toHaveProperty('type');
      expect(formatted).toHaveProperty('data');
      expect(formatted.data).toHaveProperty('labels');
      expect(formatted.data).toHaveProperty('datasets');
    });
  });
  
  describe('processOutput', () => {
  vi.setConfig({ testTimeout: 10000 }); // Added 10s timeout
    it('should process string output', () => {
      const output = `
        Starting simulation...
        Processing input...
        ERROR: Invalid input parameter 'temperature'
        Continuing with default value...
        WARNING: Model may not be accurate
        Simulation completed.
      `;
      
      const processed = outputProcessor.processOutput(output);
      
      expect(processed).toHaveProperty('summary');
      expect(processed).toHaveProperty('highlights');
      expect(processed).toHaveProperty('formatted');
      expect(processed).toHaveProperty('raw');
      expect(processed.highlights.length).toBeGreaterThan(0);
    });
    
    it('should process object output', () => {
      const output = {
        status: 'completed',
        results: {
          energy: 1000,
          savings: 200
        },
        errors: ['Invalid input parameter']
      };
      
      const processed = outputProcessor.processOutput(output);
      
      expect(processed).toHaveProperty('summary');
      expect(processed).toHaveProperty('highlights');
      expect(processed).toHaveProperty('formatted');
      expect(processed).toHaveProperty('raw');
    });
    
    it('should handle options', () => {
      const output = 'This is a test output with ERROR and WARNING keywords.';
      
      const processed = outputProcessor.processOutput(output, {
        maxSummaryLength: 20,
        includeRawOutput: false,
        format: OutputFormat.JSON
      });
      
      expect(processed.summary.length).toBeLessThanOrEqual(20);
      expect(processed).not.toHaveProperty('raw');
      expect(typeof processed.formatted).toBe('object');
    });
    
    it('should handle empty or null input', () => {
      const emptyProcessed = outputProcessor.processOutput('');
      expect(emptyProcessed.summary).toBe('');
      expect(emptyProcessed.highlights).toEqual([]);
      
      const nullProcessed = outputProcessor.processOutput(null);
      expect(nullProcessed.summary).toBe('Error processing output');
      
      const undefinedProcessed = outputProcessor.processOutput(undefined);
      expect(undefinedProcessed.summary).toBe('Error processing output');
    });
  });
});