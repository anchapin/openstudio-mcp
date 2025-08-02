/**
 * Response formatter interfaces
 */

/**
 * Response metadata interface
 */
export interface ResponseMetadata {
  timestamp: string;
  duration?: number;
  requestId?: string;
  serverVersion?: string;
  openStudioVersion?: string;
  [key: string]: unknown;
}

/**
 * Response formatter options
 */
export interface ResponseFormatterOptions {
  includeMetadata?: boolean;
  includeRawOutput?: boolean;
  includeTimestamp?: boolean;
  serverVersion?: string;
  openStudioVersion?: string;
}

/**
 * Response formatter interface
 */
export interface ResponseFormatterInterface {
  formatSuccess(
    requestId: string,
    requestType: string,
    result: unknown,
    options?: ResponseFormatterOptions,
  ): unknown;

  formatError(
    requestId: string,
    requestType: string,
    error: string | Error,
    code?: string,
    details?: unknown,
    options?: ResponseFormatterOptions,
  ): unknown;

  formatResponse(
    requestId: string,
    requestType: string,
    result: unknown,
    options?: ResponseFormatterOptions,
  ): unknown;

  addMetadata(response: unknown, metadata: ResponseMetadata): unknown;
}
