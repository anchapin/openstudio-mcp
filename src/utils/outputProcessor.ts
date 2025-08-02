/**
 * Output processor utility
 *
 * This utility is responsible for processing technical output into user-friendly formats.
 * It provides methods for summarizing text, highlighting important information,
 * and formatting different types of output.
 */
import { logger } from './index';

/**
 * Output format types
 */
export enum OutputFormat {
  TEXT = 'text',
  JSON = 'json',
  TABLE = 'table',
  CHART = 'chart',
}

/**
 * Output processor options
 */
export interface OutputProcessorOptions {
  maxSummaryLength?: number;
  highlightKeywords?: string[];
  includeRawOutput?: boolean;
  format?: OutputFormat;
}

/**
 * Processed output result
 */
export interface ProcessedOutput {
  summary: string;
  highlights: string[];
  formatted: unknown;
  raw?: string;
}

/**
 * Output processor class
 */
export class OutputProcessor {
  private defaultOptions: OutputProcessorOptions;

  /**
   * Constructor
   * @param options Default options for the output processor
   */
  constructor(options: OutputProcessorOptions = {}) {
    this.defaultOptions = {
      maxSummaryLength: 500,
      highlightKeywords: [
        'error',
        'warning',
        'failed',
        'success',
        'completed',
        'energy',
        'consumption',
        'savings',
        'reduction',
        'increase',
      ],
      includeRawOutput: true,
      format: OutputFormat.TEXT,
      ...options,
    };
  }

  /**
   * Summarize technical output
   * @param output Technical output to summarize
   * @param maxLength Maximum length of the summary
   * @returns Summarized output
   */
  public summarizeText(
    output: string,
    maxLength: number = this.defaultOptions.maxSummaryLength || 500,
  ): string {
    if (!output) return '';

    try {
      // Extract the most important lines
      const lines = output.split('\n').filter((line) => line.trim().length > 0);

      // If the output is already short, return it as is
      if (output.length <= maxLength) {
        return output;
      }

      // Extract important lines (first few lines, lines with keywords, last few lines)
      const importantLines: string[] = [];

      // Add the first 3 lines
      importantLines.push(...lines.slice(0, 3));

      // Add lines with important keywords
      const keywordLines = lines.filter((line) =>
        (this.defaultOptions.highlightKeywords || []).some((keyword) =>
          line.toLowerCase().includes(keyword.toLowerCase()),
        ),
      );

      // Add up to 5 keyword lines that aren't already included
      keywordLines.forEach((line) => {
        if (!importantLines.includes(line) && importantLines.length < 8) {
          importantLines.push(line);
        }
      });

      // Add the last 2 lines if they're not already included
      const lastLines = lines.slice(-2);
      lastLines.forEach((line) => {
        if (!importantLines.includes(line)) {
          importantLines.push(line);
        }
      });

      // Join the important lines and truncate if still too long
      let summary = importantLines.join('\n');
      if (summary.length > maxLength) {
        summary = summary.substring(0, maxLength - 3) + '...';
      }

      return summary;
    } catch (error) {
      logger.error({ error }, 'Error summarizing text');
      return output.substring(0, maxLength - 3) + '...';
    }
  }

  /**
   * Extract highlights from technical output
   * @param output Technical output to extract highlights from
   * @param keywords Keywords to highlight
   * @returns Array of highlighted lines
   */
  public extractHighlights(
    output: string,
    keywords: string[] = this.defaultOptions.highlightKeywords || [],
  ): string[] {
    if (!output) return [];

    try {
      const lines = output.split('\n').filter((line) => line.trim().length > 0);

      // Find lines containing keywords
      const highlights = lines.filter((line) =>
        keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase())),
      );

      // Limit to 10 highlights
      return highlights.length > 0 ? highlights.slice(0, 10) : [];
    } catch (error) {
      logger.error({ error }, 'Error extracting highlights');
      return [];
    }
  }

  /**
   * Format output based on the specified format
   * @param output Output to format
   * @param format Format to use
   * @returns Formatted output
   */
  public formatOutput(
    output: unknown,
    format: OutputFormat = this.defaultOptions.format || OutputFormat.TEXT,
  ): unknown {
    try {
      switch (format) {
        case OutputFormat.JSON:
          return this.formatAsJson(output);
        case OutputFormat.TABLE:
          return this.formatAsTable(output);
        case OutputFormat.CHART:
          return this.formatAsChartData(output);
        case OutputFormat.TEXT:
        default:
          return this.formatAsText(output);
      }
    } catch (error) {
      logger.error({ error }, 'Error formatting output');
      return output;
    }
  }

  /**
   * Format output as text
   * @param output Output to format
   * @returns Formatted text
   */
  private formatAsText(output: unknown): string {
    if (typeof output === 'string') {
      return output;
    }

    if (typeof output === 'object') {
      try {
        return JSON.stringify(output, null, 2);
      } catch (error) {
        return String(output);
      }
    }

    return String(output);
  }

  /**
   * Format output as JSON
   * @param output Output to format
   * @returns Formatted JSON
   */
  private formatAsJson(output: unknown): object {
    if (typeof output === 'string') {
      try {
        return JSON.parse(output);
      } catch (error) {
        // If it's not valid JSON, create a simple object
        return { text: output };
      }
    }

    if (typeof output === 'object' && output !== null) {
      return output;
    }

    return { value: output };
  }

  /**
   * Format output as table data
   * @param output Output to format
   * @returns Table data
   */
  private formatAsTable(output: unknown): { headers: string[]; rows: unknown[][] } {
    // Default empty table
    const defaultTable = { headers: [], rows: [] };

    if (typeof output === 'string') {
      try {
        // Try to parse as JSON
        const parsed = JSON.parse(output);
        return this.objectToTable(parsed);
      } catch (error) {
        // Try to parse as CSV or tab-delimited
        return this.textToTable(output);
      }
    }

    if (Array.isArray(output)) {
      if (output.length === 0) {
        return defaultTable;
      }

      if (typeof output[0] === 'object') {
        // Array of objects
        const headers = Object.keys(output[0]);
        const rows = output.map((item) => headers.map((header) => item[header]));
        return { headers, rows };
      } else {
        // Simple array
        return { headers: ['Value'], rows: output.map((item) => [item]) };
      }
    }

    if (typeof output === 'object' && output !== null) {
      return this.objectToTable(output);
    }

    return defaultTable;
  }

  /**
   * Convert an object to table data
   * @param obj Object to convert
   * @returns Table data
   */
  private objectToTable(obj: unknown): { headers: string[]; rows: unknown[][] } {
    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return { headers: [], rows: [] };
      }

      if (typeof obj[0] === 'object') {
        // Array of objects
        const headers = Object.keys(obj[0]);
        const rows = obj.map((item) => headers.map((header) => item[header]));
        return { headers, rows };
      } else {
        // Simple array
        return { headers: ['Value'], rows: obj.map((item) => [item]) };
      }
    }

    // Simple object
    const headers = ['Property', 'Value'];
    const rows = Object.entries(obj as Record<string, unknown>).map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return [key, JSON.stringify(value)];
      }
      return [key, value];
    });

    return { headers, rows };
  }

  /**
   * Convert text to table data
   * @param text Text to convert
   * @returns Table data
   */
  private textToTable(text: string): { headers: string[]; rows: unknown[][] } {
    const lines = text.trim().split('\n');

    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    // Check if it's CSV or tab-delimited
    const delimiter = text.includes('\t') ? '\t' : ',';

    // Parse headers and rows
    const headers = lines[0].split(delimiter).map((header) => header.trim());
    const rows = lines.slice(1).map((line) => line.split(delimiter).map((cell) => cell.trim()));

    return { headers, rows };
  }

  /**
   * Format output as chart data
   * @param output Output to format
   * @returns Chart data
   */
  private formatAsChartData(output: unknown): { type: string; data: unknown } {
    // Default to line chart
    const defaultChart = { type: 'line', data: { labels: [], datasets: [] } };

    try {
      if (typeof output === 'string') {
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(output);
          return this.objectToChartData(parsed);
        } catch (error) {
          // Not valid JSON
          return defaultChart;
        }
      }

      if (typeof output === 'object' && output !== null) {
        return this.objectToChartData(output);
      }

      return defaultChart;
    } catch (error) {
      logger.error({ error }, 'Error formatting chart data');
      return defaultChart;
    }
  }

  /**
   * Convert an object to chart data
   * @param obj Object to convert
   * @returns Chart data
   */
  private objectToChartData(obj: unknown): { type: string; data: unknown } {
    // If it's already in chart format, return it
    const chartObj = obj as Record<string, unknown>;
    if (chartObj.type && chartObj.data) {
      return obj as { type: string; data: unknown };
    }

    // Try to determine if it's time series data
    if (chartObj.timestamps || chartObj.dates || chartObj.times) {
      const labels = chartObj.timestamps || chartObj.dates || chartObj.times || [];
      const datasets: unknown[] = [];

      // Extract datasets
      Object.entries(chartObj).forEach(([key, value]) => {
        if (key !== 'timestamps' && key !== 'dates' && key !== 'times' && Array.isArray(value)) {
          datasets.push({
            label: key,
            data: value,
          });
        }
      });

      return {
        type: 'line',
        data: { labels, datasets },
      };
    }

    // If it's an array of objects with x and y properties, it might be scatter data
    if (Array.isArray(obj) && obj.length > 0 && obj[0].x !== undefined && obj[0].y !== undefined) {
      return {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Data',
              data: obj,
            },
          ],
        },
      };
    }

    // If it's a simple object with properties, it might be bar chart data
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      const labels = Object.keys(obj);
      const data = Object.values(obj);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Value',
              data,
            },
          ],
        },
      };
    }

    // Default to line chart with empty data
    return { type: 'line', data: { labels: [], datasets: [] } };
  }

  /**
   * Process technical output into user-friendly format
   * @param output Technical output to process
   * @param options Output processor options
   * @returns Processed output
   */
  public processOutput(output: unknown, options: OutputProcessorOptions = {}): ProcessedOutput {
    const mergedOptions = { ...this.defaultOptions, ...options };

    // Handle null or undefined input
    if (output === null || output === undefined) {
      return {
        summary: 'Error processing output',
        highlights: [],
        formatted: output,
        raw: String(output),
      };
    }

    try {
      // Convert output to string if it's not already
      const outputStr = typeof output === 'string' ? output : this.formatAsText(output);

      // Summarize the output
      const summary = this.summarizeText(outputStr, mergedOptions.maxSummaryLength);

      // Extract highlights
      const highlights = this.extractHighlights(outputStr, mergedOptions.highlightKeywords);

      // Format the output
      const formatted = this.formatOutput(output, mergedOptions.format);

      // Create the processed output
      const processedOutput: ProcessedOutput = {
        summary,
        highlights,
        formatted,
      };

      // Include raw output if requested
      if (mergedOptions.includeRawOutput) {
        processedOutput.raw = outputStr;
      }

      return processedOutput;
    } catch (error) {
      logger.error({ error }, 'Error processing output');

      // Return a basic processed output in case of error
      return {
        summary: typeof output === 'string' ? output.substring(0, 100) : 'Error processing output',
        highlights: [],
        formatted: output,
        raw: typeof output === 'string' ? output : String(output),
      };
    }
  }
}

// Create a default instance of the output processor
const outputProcessor = new OutputProcessor();

export default outputProcessor;
