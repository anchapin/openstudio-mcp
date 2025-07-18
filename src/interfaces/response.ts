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
  [key: string]: any;
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
    result: any,
    options?: ResponseFormatterOptions
  ): any;
  
  formatError(
    requestId: string,
    requestType: string,
    error: string | Error,
    code?: string,
    details?: any,
    options?: ResponseFormatterOptions
  ): any;
  
  formatResponse(
    requestId: string,
    requestType: string,
    result: any,
    options?: ResponseFormatterOptions
  ): any;
  
  addMetadata(response: any, metadata: ResponseMetadata): any;
}